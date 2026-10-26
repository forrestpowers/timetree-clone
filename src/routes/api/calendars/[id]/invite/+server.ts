import { json } from '@sveltejs/kit';
import { APP_ORIGIN } from '$app/env/private';
import { currentInvite, requireMember } from '#lib/server/calendars.js';
import type { RequestHandler } from './$types';

/** Get the calendar's invite link. `{ regenerate: true }` revokes the old link first. */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	requireMember(locals.user!.id, params.id);
	const body = await request.json().catch(() => ({}));
	const invite = currentInvite(params.id, locals.user!.id, body?.regenerate === true);
	return json({ url: `${APP_ORIGIN}/invite/${invite.token}`, expiresAt: invite.expiresAt });
};
