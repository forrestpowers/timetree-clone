import { error, json } from '@sveltejs/kit';
import { requireMember } from '#lib/server/calendars.js';
import { deleteEvent, eventInput, getEvent, updateEvent } from '#lib/server/events.js';
import type { RequestHandler } from './$types';

function load(id: string, userId: string) {
	const event = getEvent(id);
	if (!event) error(404, 'This event was deleted.');
	return { event, member: requireMember(userId, event.calendarId) };
}

export const GET: RequestHandler = ({ params, locals }) =>
	json(load(params.id, locals.user!.id).event);

export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const { event, member } = load(params.id, locals.user!.id);
	const parsed = eventInput.safeParse(await request.json());
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid event');
	if (parsed.data.calendarId !== event.calendarId)
		error(400, 'Moving events between calendars is not supported yet.');
	updateEvent(member, event, parsed.data);
	return json({ id: event.id });
};

export const DELETE: RequestHandler = ({ params, locals }) => {
	const { event, member } = load(params.id, locals.user!.id);
	deleteEvent(member, event);
	return json({ ok: true });
};
