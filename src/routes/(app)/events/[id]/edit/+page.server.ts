import { error, redirect } from '@sveltejs/kit';
import { findOccurrence, isRecurring } from '#lib/recurrence.js';
import { eventFormData } from '#lib/server/event-form-data.js';
import { loadEvent } from '#lib/server/events.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params, locals, url }) => {
	const { event } = loadEvent(params.id, locals.user!.id);
	if (event.kind === 'memo') redirect(303, `/memos/${event.id}`);
	const { calendars } = await parent();

	// Editing one occurrence of a repeating event: show that occurrence's dates
	const at = url.searchParams.get('at');
	let occurrenceStartAt: number | null = null;
	let shown = event;
	if (at && isRecurring(event)) {
		const occ = findOccurrence(event, Number(at));
		if (!occ) error(404, 'This occurrence no longer exists.');
		occurrenceStartAt = occ.occurrenceStartAt;
		shown = { ...event, startAt: occ.startAt, endAt: occ.endAt };
	}
	return { event: shown, occurrenceStartAt, ...eventFormData(calendars, locals.user!.id) };
};
