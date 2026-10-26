import type { Cookies } from '@sveltejs/kit';
import type { ClientCalendar } from '#lib/types.js';

/**
 * Which calendars a list page (activity, memos) covers: `?c=<id>|all`, falling back
 * to the calendar last opened.
 */
export function pageScope(url: URL, cookies: Cookies, calendars: ClientCalendar[]) {
	const requested = url.searchParams.get('c') ?? cookies.get('lastCal') ?? 'all';
	const calendar = calendars.find((c) => c.id === requested) ?? null;
	const ids = calendar ? [calendar.id] : calendars.filter((c) => c.me.visible).map((c) => c.id);
	return { scopeId: calendar ? calendar.id : 'all', calendar, calendarIds: ids };
}
