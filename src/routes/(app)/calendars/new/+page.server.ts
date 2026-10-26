import { fail, redirect } from '@sveltejs/kit';
import { createCalendar } from '#lib/server/calendars.js';
import { CALENDAR_PURPOSES, type CalendarPurpose } from '#lib/server/db/schema.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const purpose = String(form.get('purpose') ?? 'other') as CalendarPurpose;
		if (!name) return fail(400, { name, purpose, message: 'Enter a calendar name.' });
		if (name.length > 50)
			return fail(400, { name, purpose, message: 'Character count exceeds the limit (50).' });
		if (!CALENDAR_PURPOSES.includes(purpose))
			return fail(400, { name, purpose, message: 'Pick a calendar type.' });
		const calendar = createCalendar(locals.user!.id, { name, purpose });
		redirect(303, `/c/${calendar.id}/invite?created=1`);
	}
};
