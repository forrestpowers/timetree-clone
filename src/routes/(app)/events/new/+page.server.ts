import { redirect } from '@sveltejs/kit';
import { todayKey } from '#lib/dates.js';
import { eventFormData } from '#lib/server/event-form-data.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url, locals }) => {
	const { calendars, tz } = await parent();
	if (!calendars.length) redirect(303, '/calendars/new?first=1');
	const requested = url.searchParams.get('calendar');
	const date = url.searchParams.get('date');
	return {
		...eventFormData(calendars, locals.user!.id),
		initialCalendarId: calendars.some((c) => c.id === requested) ? requested! : calendars[0].id,
		initialDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayKey(tz),
		initialTitle: url.searchParams.get('title') ?? ''
	};
};
