import { listLabels, listMembers, listVirtualMembers } from '#lib/server/calendars.js';
import type { ClientCalendar } from '#lib/types.js';

/** Everything the event editor needs to switch between the user's calendars. */
export function eventFormData(calendars: ClientCalendar[], userId: string) {
	const ids = calendars.map((c) => c.id);
	return {
		labels: listLabels(ids),
		members: listMembers(ids, userId),
		virtualMembers: listVirtualMembers(ids)
	};
}
