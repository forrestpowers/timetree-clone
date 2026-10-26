import { error, json } from '@sveltejs/kit';
import { requireMember } from '#lib/server/calendars.js';
import { createEvent, eventInput } from '#lib/server/events.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	const parsed = eventInput.safeParse(await request.json());
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid event');
	const member = requireMember(locals.user!.id, parsed.data.calendarId);
	const id = createEvent(member, parsed.data, locals.user!.id);
	return json({ id });
};
