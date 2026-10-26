import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireMember } from '#lib/server/calendars.js';
import { findConflicts } from '#lib/server/events.js';
import type { RequestHandler } from './$types';

const schema = z.object({
	calendarId: z.string(),
	attendeeIds: z.array(z.string()).max(200),
	startAt: z.number().int(),
	endAt: z.number().int(),
	excludeEventId: z.string().nullable().default(null)
});

/** Which of the chosen attendees are already in another event at that time. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const body = schema.safeParse(await request.json());
	if (!body.success) error(400, 'Invalid input');
	const { calendarId, attendeeIds, startAt, endAt, excludeEventId } = body.data;
	requireMember(locals.user!.id, calendarId);
	return json(findConflicts([calendarId], attendeeIds, startAt, endAt, excludeEventId));
};
