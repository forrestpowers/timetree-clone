import { listMembers, listUserCalendars } from '#lib/server/calendars.js';
import { getReadMarker, listFeed, markRead } from '#lib/server/feed.js';
import { pageScope } from '#lib/server/scope.js';
import type { PageServerLoad } from './$types';

// Not using parent(): refreshing the tab badges must not reload (and re-mark) the feed
export const load: PageServerLoad = async ({ url, cookies, locals, depends }) => {
	depends('app:feed');
	const calendars = listUserCalendars(locals.user!.id);
	const { scopeId, calendar, calendarIds } = pageScope(url, cookies, calendars);
	const before = Number(url.searchParams.get('before')) || null;
	const items = listFeed(calendarIds, before);

	// Remember where "new" started, then mark everything shown as read
	const readSince = Object.fromEntries(
		calendars
			.filter((c) => calendarIds.includes(c.id))
			.map((c) => [c.id, getReadMarker(c.me.memberId, 'feed')])
	);
	if (!before)
		for (const c of calendars) if (calendarIds.includes(c.id)) markRead(c.me.memberId, 'feed');

	return {
		scopeId,
		calendar,
		items,
		readSince,
		members: listMembers(calendarIds, locals.user!.id),
		hasMore: items.length === 60,
		before
	};
};
