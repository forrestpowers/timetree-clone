import { error, fail, redirect } from '@sveltejs/kit';
import { SIGNUP_MODE } from '$app/env/private';
import { hashPassword, passwordProblem } from '#lib/server/auth/crypto.js';
import { sendVerificationEmail } from '#lib/server/auth/email-tokens.js';
import { rateLimit } from '#lib/server/auth/rate-limit.js';
import { createSession, safeClientAddress } from '#lib/server/auth/session.js';
import { findInvite } from '#lib/server/calendars.js';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import { findUserByEmail, isEmail, normalizeEmail, userCount } from '#lib/server/users.js';
import type { Actions, PageServerLoad } from './$types';

/** The invite token in `?next=/invite/<token>`, if any. */
function inviteTokenFrom(url: URL): string | null {
	const next = url.searchParams.get('next') ?? '';
	return next.match(/^\/invite\/([\w-]+)$/)?.[1] ?? null;
}

function signupAllowed(url: URL) {
	if (SIGNUP_MODE === 'open' || userCount() === 0) return true;
	const token = inviteTokenFrom(url);
	return !!(token && findInvite(token));
}

export const load: PageServerLoad = ({ url }) => {
	return { allowed: signupAllowed(url), firstUser: userCount() === 0 };
};

export const actions: Actions = {
	default: async (event) => {
		if (!signupAllowed(event.url)) error(403, 'Sign-up needs an invitation link.');
		if (!rateLimit(`signup:${safeClientAddress(event)}`, 10, 60 * 60_000)) {
			return fail(429, {
				name: '',
				email: '',
				message: 'Too many sign-ups from this network. Try again later.'
			});
		}

		const form = await event.request.formData();
		const name = String(form.get('name') ?? '')
			.trim()
			.slice(0, 50);
		const email = normalizeEmail(String(form.get('email') ?? ''));
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');
		const values = { name, email };

		if (!name) return fail(400, { ...values, message: 'Enter your name.' });
		if (!isEmail(email)) return fail(400, { ...values, message: 'Enter a valid email address.' });
		const problem = passwordProblem(password);
		if (problem) return fail(400, { ...values, message: problem });
		if (password !== confirm) return fail(400, { ...values, message: 'Passwords do not match.' });
		if (findUserByEmail(email)) {
			return fail(400, {
				...values,
				message: 'This email address is already in use. Try logging in.'
			});
		}

		const user = db
			.insert(users)
			.values({ email, name, passwordHash: await hashPassword(password) })
			.returning()
			.get();
		await sendVerificationEmail(user);
		createSession(user.id, event);

		const token = inviteTokenFrom(event.url);
		redirect(303, token ? `/invite/${token}` : '/');
	}
};
