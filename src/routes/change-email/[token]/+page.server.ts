import { eq } from 'drizzle-orm';
import { consumeEmailToken } from '#lib/server/auth/email-tokens.js';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import { findUserByEmail } from '#lib/server/users.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const token = consumeEmailToken(params.token, 'change_email');
	if (!token?.newEmail) return { ok: false, reason: 'This link has expired or was already used.' };
	const taken = findUserByEmail(token.newEmail);
	if (taken && taken.id !== token.userId)
		return { ok: false, reason: 'That email address is already in use.' };
	db.update(users)
		.set({ email: token.newEmail, emailVerifiedAt: Date.now() })
		.where(eq(users.id, token.userId))
		.run();
	return { ok: true, reason: '' };
};
