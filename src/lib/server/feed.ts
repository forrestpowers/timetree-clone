import { and, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { activities, events, readMarkers } from '#lib/server/db/schema.js';
import type { ClientActivity, ClientCalendar } from '#lib/types.js';

export type ReadScope = 'feed' | 'chat' | 'memos' | `event:${string}`;

export function getReadMarker(memberId: string, scope: ReadScope): number {
	return (
		db
			.select({ at: readMarkers.lastReadAt })
			.from(readMarkers)
			.where(and(eq(readMarkers.memberId, memberId), eq(readMarkers.scope, scope)))
			.get()?.at ?? 0
	);
}

export function markRead(memberId: string, scope: ReadScope, at = Date.now()) {
	db.insert(readMarkers)
		.values({ memberId, scope, lastReadAt: at })
		.onConflictDoUpdate({
			target: [readMarkers.memberId, readMarkers.scope],
			set: { lastReadAt: sql`max(${readMarkers.lastReadAt}, ${at})` }
		})
		.run();
}

/** Unread counts for the tab badges, across the calendars shown in All Calendars. */
export function unreadCounts(calendars: ClientCalendar[]) {
	let feed = 0;
	let memos = 0;
	for (const c of calendars.filter((c) => c.me.visible)) {
		const me = c.me.memberId;
		feed += db
			.select({ n: sql<number>`count(*)` })
			.from(activities)
			.where(
				and(
					eq(activities.calendarId, c.id),
					gt(activities.createdAt, getReadMarker(me, 'feed')),
					or(isNull(activities.actorMemberId), ne(activities.actorMemberId, me)),
					isNull(activities.deletedAt)
				)
			)
			.get()!.n;
		memos += db
			.select({ n: sql<number>`count(*)` })
			.from(events)
			.where(
				and(
					eq(events.calendarId, c.id),
					eq(events.kind, 'memo'),
					isNull(events.deletedAt),
					gt(events.updatedAt, getReadMarker(me, 'memos')),
					or(isNull(events.createdByMemberId), ne(events.createdByMemberId, me))
				)
			)
			.get()!.n;
	}
	return { feed, memos };
}

/** Newest-first activity across calendars, with the event's current title when it still exists. */
export function listFeed(
	calendarIds: string[],
	before: number | null,
	limit = 60
): ClientActivity[] {
	if (!calendarIds.length) return [];
	const rows = db
		.select({
			a: activities,
			eventTitle: events.title,
			eventKind: events.kind,
			eventDeleted: events.deletedAt
		})
		.from(activities)
		.leftJoin(events, eq(events.id, activities.eventId))
		.where(
			and(
				inArray(activities.calendarId, calendarIds),
				isNull(activities.deletedAt),
				before ? lt(activities.createdAt, before) : undefined
			)
		)
		.orderBy(desc(activities.createdAt))
		.limit(limit)
		.all();
	return rows.map(({ a, eventTitle, eventKind, eventDeleted }) =>
		toClientActivity(a, { title: eventTitle, kind: eventKind, deleted: !!eventDeleted })
	);
}

export function toClientActivity(
	a: typeof activities.$inferSelect,
	event: { title: string | null; kind: 'event' | 'memo' | null; deleted: boolean } | null = null
): ClientActivity {
	return {
		id: a.id,
		calendarId: a.calendarId,
		eventId: a.eventId,
		actorMemberId: a.actorMemberId,
		type: a.type,
		data: a.data,
		createdAt: a.createdAt,
		updatedAt: a.updatedAt,
		event:
			event && event.title != null
				? { title: event.title, kind: event.kind ?? 'event', deleted: event.deleted }
				: null
	};
}
