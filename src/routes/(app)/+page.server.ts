import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, cookies }) => {
	const { calendars } = await parent();
	if (!calendars.length) redirect(303, '/calendars/new?first=1');
	const last = cookies.get('lastCal');
	const target =
		last === 'all' || calendars.some((c) => c.id === last)
			? last
			: calendars.length > 1
				? 'all'
				: calendars[0].id;
	redirect(303, `/c/${target}`);
};
