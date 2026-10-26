import { error } from '@sveltejs/kit';
import { requireMember } from '#lib/server/calendars.js';
import { eventFormData } from '#lib/server/event-form-data.js';
import { getEvent } from '#lib/server/events.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params, locals }) => {
	const event = getEvent(params.id);
	if (!event) error(404, 'This event was deleted.');
	requireMember(locals.user!.id, event.calendarId);
	const { calendars } = await parent();
	return { event, ...eventFormData(calendars, locals.user!.id) };
};
