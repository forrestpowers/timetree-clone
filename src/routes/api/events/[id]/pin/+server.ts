import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { loadEvent, setPinned } from '#lib/server/events.js';
import type { RequestHandler } from './$types';

/** { pinned, occurrenceStartAt? } — with an occurrence, pins only that one. */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const { event } = loadEvent(params.id, locals.user!.id);
	const body = z
		.object({ pinned: z.boolean(), occurrenceStartAt: z.number().int().nullable().default(null) })
		.safeParse(await request.json());
	if (!body.success) error(400, 'Invalid input');
	setPinned(event, body.data.pinned, body.data.occurrenceStartAt);
	return json({ ok: true });
};
