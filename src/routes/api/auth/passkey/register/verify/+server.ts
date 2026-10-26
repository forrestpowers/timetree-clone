import { error, json } from '@sveltejs/kit';
import { verifyRegistration } from '#lib/server/auth/passkeys.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies, request }) => {
	if (!locals.user) error(401);
	const body = await request.json();
	try {
		await verifyRegistration(locals.user, cookies, body.response, String(body.name ?? ''));
		return json({ ok: true });
	} catch (e) {
		return json({ message: (e as Error).message }, { status: 400 });
	}
};
