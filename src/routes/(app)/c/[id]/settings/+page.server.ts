import { getCalendar, listLabels, listMembers, listVirtualMembers } from '#lib/server/calendars.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals, depends }) => {
	depends('app:calendar');
	const calendar = getCalendar(locals.user!.id, params.id);
	const members = listMembers([params.id], locals.user!.id);
	return {
		calendar,
		me: members.find((m) => m.isMe)!,
		memberCount: members.length,
		virtualCount: listVirtualMembers([params.id]).length,
		labels: listLabels([params.id])
	};
};
