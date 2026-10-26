import { json } from '@sveltejs/kit';
import { verifyAuthentication } from '#lib/server/auth/passkeys.js';
import { rateLimit } from '#lib/server/auth/rate-limit.js';
import { createSession, safeClientAddress } from '#lib/server/auth/session.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!rateLimit(`passkey:${safeClientAddress(event)}`, 30, 15 * 60_000)) {
		return json({ message: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });
	}
	try {
		const userId = await verifyAuthentication(event.cookies, await event.request.json());
		createSession(userId, event);
		return json({ ok: true });
	} catch (e) {
		return json({ message: (e as Error).message }, { status: 400 });
	}
};
