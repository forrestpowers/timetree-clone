import { APP_ORIGIN } from '$app/env/private';
import { currentInvite, getCalendar } from '#lib/server/calendars.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals }) => {
	const calendar = getCalendar(locals.user!.id, params.id);
	const invite = currentInvite(params.id, locals.user!.id);
	return {
		calendar,
		inviteUrl: `${APP_ORIGIN}/invite/${invite.token}`,
		expiresAt: invite.expiresAt
	};
};
