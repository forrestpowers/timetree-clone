import { error, redirect } from '@sveltejs/kit';
import { and, desc, eq, or } from 'drizzle-orm';
import { findOccurrence, isRecurring } from '#lib/recurrence.js';
import { getCalendar, listLabels, listMembers, listVirtualMembers } from '#lib/server/calendars.js';
import { db } from '#lib/server/db/index.js';
import { activities } from '#lib/server/db/schema.js';
import { listComments } from '#lib/server/comments.js';
import { loadEvent } from '#lib/server/events.js';
import { markRead } from '#lib/server/feed.js';
import { reactionsFor } from '#lib/server/reactions.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals, depends, url }) => {
	depends('app:event');
	const { event: series } = loadEvent(params.id, locals.user!.id);
	if (series.kind === 'memo') redirect(303, `/memos/${series.id}`);
	const calendar = getCalendar(locals.user!.id, series.calendarId);

	// A specific occurrence of a repeating event (?at=<start instant>)
	let occurrenceStartAt: number | null = null;
	let event = series;
	const at = url.searchParams.get('at');
	if (isRecurring(series)) {
		const occ = findOccurrence(series, at ? Number(at) : series.startAt!);
		if (!occ) error(404, 'This occurrence no longer exists.');
		occurrenceStartAt = occ.occurrenceStartAt;
		event = { ...series, startAt: occ.startAt, endAt: occ.endAt };
	}

	const history = db
		.select({
			id: activities.id,
			type: activities.type,
			actorMemberId: activities.actorMemberId,
			data: activities.data,
			createdAt: activities.createdAt
		})
		.from(activities)
		.where(
			and(
				eq(activities.calendarId, series.calendarId),
				// Include the series this event was split from
				series.parentId
					? or(eq(activities.eventId, series.id), eq(activities.eventId, series.parentId))
					: eq(activities.eventId, series.id)
			)
		)
		.orderBy(desc(activities.createdAt))
		.limit(50)
		.all();

	const mine = new Set([calendar.me.memberId]);
	markRead(calendar.me.memberId, `event:${series.id}`);

	return {
		event,
		comments: listComments([series.id], mine),
		reactions: reactionsFor('event', [series.id], mine).get(series.id) ?? [],
		seriesStartAt: series.startAt,
		occurrenceStartAt,
		calendar,
		labels: listLabels([series.calendarId]),
		members: listMembers([series.calendarId], locals.user!.id),
		virtualMembers: listVirtualMembers([series.calendarId]),
		history
	};
};
