import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { deleteEvent, eventInput, loadEvent, updateEvent } from '#lib/server/events.js';
import type { RequestHandler } from './$types';

const scopeSchema = z.object({
	scope: z.enum(['this', 'future', 'all']).default('all'),
	occurrenceStartAt: z.number().int().nullable().default(null)
});

export const GET: RequestHandler = ({ params, locals }) =>
	json(loadEvent(params.id, locals.user!.id).event);

/** Body: event fields plus `scope` and `occurrenceStartAt` for repeating events. */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const { event, member } = loadEvent(params.id, locals.user!.id);
	const body = await request.json();
	const parsed = eventInput.safeParse(body);
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid event');
	const { scope, occurrenceStartAt } = scopeSchema.parse(body);
	if (parsed.data.calendarId !== event.calendarId)
		error(400, 'Use "Copy to another calendar" to move events between calendars.');
	const id = await updateEvent(
		member,
		locals.user!.id,
		event,
		parsed.data,
		scope,
		occurrenceStartAt
	);
	return json({ id });
};

/** ?scope=this|future|all&at=<occurrence start> */
export const DELETE: RequestHandler = async ({ params, locals, url }) => {
	const { event, member } = loadEvent(params.id, locals.user!.id);
	const { scope, occurrenceStartAt } = scopeSchema.parse({
		scope: url.searchParams.get('scope') ?? undefined,
		occurrenceStartAt: url.searchParams.get('at') ? Number(url.searchParams.get('at')) : null
	});
	await deleteEvent(member, event, scope, occurrenceStartAt);
	return json({ ok: true });
};
