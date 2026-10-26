import { listLabels, listMembers, listUserCalendars } from '#lib/server/calendars.js';
import { getReadMarker, markRead } from '#lib/server/feed.js';
import { listMemos } from '#lib/server/memos.js';
import { pageScope } from '#lib/server/scope.js';
import type { PageServerLoad } from './$types';

// Not using parent(): refreshing the tab badges must not reload (and re-mark) the list
export const load: PageServerLoad = ({ url, cookies, locals, depends }) => {
	depends('app:memos');
	const calendars = listUserCalendars(locals.user!.id);
	const { scopeId, calendar, calendarIds } = pageScope(url, cookies, calendars);
	const shown = calendars.filter((c) => calendarIds.includes(c.id));
	const readSince = Object.fromEntries(
		shown.map((c) => [c.id, getReadMarker(c.me.memberId, 'memos')])
	);
	for (const c of shown) markRead(c.me.memberId, 'memos');
	return {
		scopeId,
		calendar,
		memos: listMemos(calendarIds),
		labels: listLabels(calendarIds),
		members: listMembers(calendarIds, locals.user!.id),
		readSince
	};
};
