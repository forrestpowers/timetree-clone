import { fail, redirect } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { hashPassword, passwordProblem, verifyPassword } from '#lib/server/auth/crypto.js';
import {
	sendChangeEmailConfirmation,
	sendVerificationEmail
} from '#lib/server/auth/email-tokens.js';
import { rateLimit } from '#lib/server/auth/rate-limit.js';
import { clearSessionCookie, invalidateUserSessions } from '#lib/server/auth/session.js';
import { removeMember } from '#lib/server/calendars.js';
import { db } from '#lib/server/db/index.js';
import { calendarMembers, users } from '#lib/server/db/schema.js';
import { findUserByEmail, isEmail, normalizeEmail } from '#lib/server/users.js';
import type { Actions } from './$types';

async function checkPassword(userId: string, password: string) {
	if (!rateLimit(`pw-check:${userId}`, 10, 15 * 60_000))
		return 'Too many attempts. Try again later.';
	const user = db.select().from(users).where(eq(users.id, userId)).get();
	if (!user?.passwordHash) return null; // passkey-only accounts have no password to check
	return (await verifyPassword(password, user.passwordHash))
		? null
		: 'Your current password is incorrect.';
}

export const actions: Actions = {
	resend: async ({ locals }) => {
		const user = locals.user!;
		if (user.emailVerifiedAt) return { resent: false };
		if (!rateLimit(`verify:${user.id}`, 3, 60 * 60_000))
			return fail(429, { section: 'verify', message: 'Please wait before sending another email.' });
		await sendVerificationEmail(user);
		return { section: 'verify', message: `A verification email was sent to ${user.email}.` };
	},

	email: async ({ locals, request }) => {
		const form = await request.formData();
		const email = normalizeEmail(String(form.get('email') ?? ''));
		if (!isEmail(email))
			return fail(400, { section: 'email', message: 'Enter a valid email address.' });
		if (email === locals.user!.email)
			return fail(400, { section: 'email', message: 'This is your current email address.' });
		const problem = await checkPassword(locals.user!.id, String(form.get('password') ?? ''));
		if (problem) return fail(400, { section: 'email', message: problem });
		if (findUserByEmail(email))
			return fail(400, { section: 'email', message: 'The email address is already in use.' });
		await sendChangeEmailConfirmation(locals.user!.id, email);
		return {
			section: 'email',
			message: `We sent a confirmation link to ${email}. Your email changes once you open it.`
		};
	},

	password: async ({ locals, request }) => {
		const form = await request.formData();
		const next = String(form.get('new') ?? '');
		const problem = await checkPassword(locals.user!.id, String(form.get('current') ?? ''));
		if (problem) return fail(400, { section: 'password', message: problem });
		const weak = passwordProblem(next);
		if (weak) return fail(400, { section: 'password', message: weak });
		if (next !== form.get('confirm'))
			return fail(400, { section: 'password', message: 'Passwords do not match.' });
		db.update(users)
			.set({ passwordHash: await hashPassword(next) })
			.where(eq(users.id, locals.user!.id))
			.run();
		return { section: 'password', message: 'Your password was changed.' };
	},

	delete: async ({ locals, request, cookies }) => {
		const form = await request.formData();
		const user = locals.user!;
		const problem = await checkPassword(user.id, String(form.get('password') ?? ''));
		if (problem) return fail(400, { section: 'delete', message: problem });
		if (form.get('confirm') !== 'DELETE')
			return fail(400, { section: 'delete', message: 'Type DELETE to confirm.' });

		const memberships = db
			.select()
			.from(calendarMembers)
			.where(and(eq(calendarMembers.userId, user.id), isNull(calendarMembers.removedAt)))
			.all();
		for (const m of memberships) removeMember(m.calendarId, m.id, m.id);
		// Keep the row (other members' history refers to it) but free the email address
		db.update(users)
			.set({
				deletedAt: Date.now(),
				email: `deleted-${user.id}@invalid`,
				passwordHash: null,
				name: 'Former member',
				avatarFileId: null
			})
			.where(eq(users.id, user.id))
			.run();
		invalidateUserSessions(user.id);
		clearSessionCookie(cookies);
		redirect(303, '/login');
	}
};
