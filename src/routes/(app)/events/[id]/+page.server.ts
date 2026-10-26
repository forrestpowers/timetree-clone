import { error } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { getCalendar, listLabels, listMembers, listVirtualMembers } from '#lib/server/calendars.js';
import { db } from '#lib/server/db/index.js';
import { activities } from '#lib/server/db/schema.js';
import { getEvent } from '#lib/server/events.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals, depends }) => {
	depends('app:event');
	const event = getEvent(params.id);
	if (!event) error(404, 'This event was deleted.');
	const calendar = getCalendar(locals.user!.id, event.calendarId);
	const history = db
		.select({
			id: activities.id,
			type: activities.type,
			actorMemberId: activities.actorMemberId,
			data: activities.data,
			createdAt: activities.createdAt
		})
		.from(activities)
		.where(and(eq(activities.eventId, event.id), eq(activities.calendarId, event.calendarId)))
		.orderBy(desc(activities.createdAt))
		.limit(50)
		.all();
	return {
		event,
		calendar,
		labels: listLabels([event.calendarId]),
		members: listMembers([event.calendarId], locals.user!.id),
		virtualMembers: listVirtualMembers([event.calendarId]),
		history
	};
};
