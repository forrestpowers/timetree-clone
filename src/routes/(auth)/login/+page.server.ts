import { fail, redirect } from '@sveltejs/kit';
import { verifyPassword } from '#lib/server/auth/crypto.js';
import { rateLimit } from '#lib/server/auth/rate-limit.js';
import { createSession, safeClientAddress } from '#lib/server/auth/session.js';
import { safeNext } from '#lib/server/redirects.js';
import { findUserByEmail, normalizeEmail } from '#lib/server/users.js';
import type { Actions } from './$types';

// Spend the same time when the account doesn't exist
const DUMMY_HASH = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86);

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const email = normalizeEmail(String(form.get('email') ?? ''));
		const password = String(form.get('password') ?? '');
		const ip = safeClientAddress(event);

		if (
			!rateLimit(`login:${ip}`, 30, 15 * 60_000) ||
			!rateLimit(`login:${ip}:${email}`, 8, 15 * 60_000)
		) {
			return fail(429, {
				email,
				message: 'Too many attempts. Please wait a few minutes and try again.'
			});
		}
		if (!email || !password) return fail(400, { email, message: 'Enter your email and password.' });

		const user = findUserByEmail(email);
		const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
		if (!user || !user.passwordHash || !ok) {
			return fail(400, { email, message: 'The email address or password is incorrect.' });
		}

		createSession(user.id, event);
		redirect(303, safeNext(event.url.searchParams.get('next')));
	}
};
