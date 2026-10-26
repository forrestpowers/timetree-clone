import { fail } from '@sveltejs/kit';
import { sendPasswordResetEmail } from '#lib/server/auth/email-tokens.js';
import { rateLimit } from '#lib/server/auth/rate-limit.js';
import { safeClientAddress } from '#lib/server/auth/session.js';
import { isEmail, normalizeEmail } from '#lib/server/users.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async (event) => {
		const email = normalizeEmail(String((await event.request.formData()).get('email') ?? ''));
		if (!isEmail(email)) return fail(400, { email, message: 'Enter a valid email address.' });
		if (
			!rateLimit(`reset:${safeClientAddress(event)}`, 5, 60 * 60_000) ||
			!rateLimit(`reset:${email}`, 3, 60 * 60_000)
		) {
			return fail(429, { email, message: 'Too many requests. Try again later.' });
		}
		await sendPasswordResetEmail(email);
		return { sent: true, email };
	}
};
