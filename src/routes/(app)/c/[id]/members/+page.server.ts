import { getCalendar, listMembers, listVirtualMembers } from '#lib/server/calendars.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals, depends }) => {
	depends('app:calendar');
	return {
		calendar: getCalendar(locals.user!.id, params.id),
		members: listMembers([params.id], locals.user!.id),
		virtualMembers: listVirtualMembers([params.id])
	};
};
