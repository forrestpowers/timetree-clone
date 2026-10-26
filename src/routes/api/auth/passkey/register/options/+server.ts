import { error, json } from '@sveltejs/kit';
import { registrationOptions } from '#lib/server/auth/passkeys.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies }) => {
	if (!locals.user) error(401);
	return json(await registrationOptions(locals.user, cookies));
};
