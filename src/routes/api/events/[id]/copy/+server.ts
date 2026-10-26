import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireMember } from '#lib/server/calendars.js';
import { copyEvent, loadEvent } from '#lib/server/events.js';
import type { RequestHandler } from './$types';

const MAX_COPY_DATES = 31;

const schema = z.object({
	calendarId: z.string().optional(),
	dates: z
		.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
		.min(1)
		.max(MAX_COPY_DATES)
		.optional(),
	occurrenceStartAt: z.number().int().nullable().default(null)
});

/**
 * Copy to another calendar ({ calendarId }) or to several dates in the same
 * calendar ({ dates }). Returns the new event ids.
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const { event, member } = loadEvent(params.id, locals.user!.id);
	const body = schema.safeParse(await request.json());
	if (!body.success) error(400, body.error.issues[0]?.message ?? 'Invalid input');
	const targetMember = body.data.calendarId
		? requireMember(locals.user!.id, body.data.calendarId)
		: member;
	const ids = copyEvent(member, event, body.data.occurrenceStartAt, {
		calendarMember: targetMember,
		dates: body.data.dates ?? null
	});
	return json({ ids, calendarId: targetMember.calendarId });
};
