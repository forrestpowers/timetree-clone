import { error } from '@sveltejs/kit';
import { requireMember, listVirtualMembers } from '#lib/server/calendars.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals }) => {
	requireMember(locals.user!.id, params.id);
	if (params.vid === 'new') return { calendarId: params.id, virtual: null };
	const virtual = listVirtualMembers([params.id]).find((v) => v.id === params.vid);
	if (!virtual) error(404, 'Virtual member not found');
	return { calendarId: params.id, virtual };
};
