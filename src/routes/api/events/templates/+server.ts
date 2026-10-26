import { error, json } from '@sveltejs/kit';
import { requireMember } from '#lib/server/calendars.js';
import { eventTemplates } from '#lib/server/events.js';
import type { RequestHandler } from './$types';

/** ?calendarId= — the caller's most-used event shapes in that calendar. */
export const GET: RequestHandler = ({ url, locals }) => {
	const calendarId = url.searchParams.get('calendarId');
	if (!calendarId) error(400, 'calendarId is required');
	const member = requireMember(locals.user!.id, calendarId);
	return json(eventTemplates(calendarId, member.id));
};
