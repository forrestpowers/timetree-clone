import { error, json } from '@sveltejs/kit';
import { loadEvent, setChecklistItem } from '#lib/server/events.js';
import type { RequestHandler } from './$types';

/** Tick or untick one to-do item: { done: boolean } */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const { event, member } = loadEvent(params.id, locals.user!.id);
	const body = await request.json().catch(() => null);
	if (typeof body?.done !== 'boolean') error(400, 'Invalid input');
	setChecklistItem(member, event, params.itemId, body.done);
	return json({ ok: true });
};
