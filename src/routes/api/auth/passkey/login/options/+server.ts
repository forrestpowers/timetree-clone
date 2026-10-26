import { json } from '@sveltejs/kit';
import { authenticationOptions } from '#lib/server/auth/passkeys.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) =>
	json(await authenticationOptions(cookies));
