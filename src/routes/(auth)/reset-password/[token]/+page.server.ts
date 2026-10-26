import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { hashPassword, passwordProblem } from '#lib/server/auth/crypto.js';
import { consumeEmailToken, peekEmailToken } from '#lib/server/auth/email-tokens.js';
import { createSession, invalidateUserSessions } from '#lib/server/auth/session.js';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	return { valid: !!peekEmailToken(params.token, 'reset') };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const password = String(form.get('password') ?? '');
		const problem = passwordProblem(password);
		if (problem) return fail(400, { message: problem });
		if (password !== form.get('confirm')) return fail(400, { message: 'Passwords do not match.' });

		const token = consumeEmailToken(event.params.token, 'reset');
		if (!token) return fail(400, { message: 'This link has expired. Request a new one.' });

		// A reset proves control of the inbox, so it also verifies the email
		db.update(users)
			.set({ passwordHash: await hashPassword(password), emailVerifiedAt: Date.now() })
			.where(eq(users.id, token.userId))
			.run();
		invalidateUserSessions(token.userId);
		createSession(token.userId, event);
		redirect(303, '/');
	}
};
