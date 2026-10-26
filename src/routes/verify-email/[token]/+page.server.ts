import { eq } from 'drizzle-orm';
import { consumeEmailToken } from '#lib/server/auth/email-tokens.js';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const token = consumeEmailToken(params.token, 'verify');
	if (token)
		db.update(users).set({ emailVerifiedAt: Date.now() }).where(eq(users.id, token.userId)).run();
	return { ok: !!token, title: 'Email verification' };
};
