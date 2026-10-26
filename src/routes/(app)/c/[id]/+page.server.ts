import { error } from '@sveltejs/kit';
import { DAY_MS, dateToUtcMs, monthGrid, todayKey } from '#lib/dates.js';
import { listLabels, listMembers, listVirtualMembers, touchMember } from '#lib/server/calendars.js';
import { listEvents } from '#lib/server/events.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, parent, cookies, locals, depends }) => {
	depends('app:events');
	const { calendars, tz } = await parent();
	const all = params.id === 'all';
	const calendar = all ? null : calendars.find((c) => c.id === params.id);
	if (!all && !calendar) error(404, 'Calendar not found');

	cookies.set('lastCal', params.id, { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 365 });
	if (calendar) touchMember(calendar.me.memberId);

	const monthParam = url.searchParams.get('month');
	const month =
		monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : todayKey(tz).slice(0, 7);
	const weekStart = locals.user!.settings.weekStart ?? 0;
	const days = monthGrid(month, weekStart);

	const calendarIds = all ? calendars.filter((c) => c.me.visible).map((c) => c.id) : [params.id];
	// Pad a day on each side so timed events near midnight in any zone are included
	const from = dateToUtcMs(days[0]) - DAY_MS;
	const to = dateToUtcMs(days[41]) + 2 * DAY_MS;

	return {
		calendarId: params.id,
		calendar,
		calendarIds,
		month,
		days,
		weekStart,
		events: listEvents(calendarIds, from, to),
		labels: listLabels(calendarIds),
		members: listMembers(calendarIds, locals.user!.id),
		virtualMembers: listVirtualMembers(calendarIds)
	};
};
