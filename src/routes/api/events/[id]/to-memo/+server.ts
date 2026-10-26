import { error, json } from '@sveltejs/kit';
import { loadEvent } from '#lib/server/events.js';
import { eventToMemo } from '#lib/server/memos.js';
import type { RequestHandler } from './$types';

/** "Save as memo": the event loses its date and repeat. */
export const POST: RequestHandler = ({ params, locals }) => {
	const { event, member } = loadEvent(params.id, locals.user!.id);
	if (event.kind !== 'event') error(400, 'Already a memo');
	eventToMemo(member, event);
	return json({ id: event.id });
};
