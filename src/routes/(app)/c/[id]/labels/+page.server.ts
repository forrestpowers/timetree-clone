import { requireMember, listLabels } from '#lib/server/calendars.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals }) => {
	requireMember(locals.user!.id, params.id);
	return { calendarId: params.id, labels: listLabels([params.id]) };
};
