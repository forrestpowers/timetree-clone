import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import type { Member } from '#lib/server/calendars.js';
import { db } from '#lib/server/db/index.js';
import { activities, chatMessages, events } from '#lib/server/db/schema.js';
import { getReadMarker } from '#lib/server/feed.js';
import { toClientActivity } from '#lib/server/feed.js';
import { publish } from '#lib/server/live.js';
import { reactionsFor } from '#lib/server/reactions.js';
import type { ClientActivity, ClientChatMessage } from '#lib/types.js';

export const MAX_MESSAGE_LENGTH = 2000;
const PAGE = 100;

export function sendMessage(member: Member, body: string, eventId: string | null = null) {
	const text = body.trim().slice(0, MAX_MESSAGE_LENGTH);
	if (eventId) {
		const e = db
			.select()
			.from(events)
			.where(and(eq(events.id, eventId), isNull(events.deletedAt)))
			.get();
		if (!e || e.calendarId !== member.calendarId) error(404, 'Event not found');
	} else if (!text) {
		error(400, 'Write a message first.');
	}
	const row = db
		.insert(chatMessages)
		.values({
			calendarId: member.calendarId,
			memberId: member.id,
			kind: eventId ? 'event' : 'text',
			body: text,
			eventId
		})
		.returning({ id: chatMessages.id })
		.get()!;
	publish({ calendarId: member.calendarId, kinds: ['chat'], actorMemberId: member.id });
	return row.id;
}

export function deleteMessage(member: Member, messageId: string) {
	const row = db.select().from(chatMessages).where(eq(chatMessages.id, messageId)).get();
	if (!row || row.calendarId !== member.calendarId || row.deletedAt)
		error(404, 'Message not found');
	if (row.memberId !== member.id && member.role !== 'owner')
		error(403, 'You can only delete your own messages.');
	db.update(chatMessages)
		.set({ deletedAt: Date.now() })
		.where(eq(chatMessages.id, messageId))
		.run();
	publish({ calendarId: member.calendarId, kinds: ['chat'], actorMemberId: member.id });
}

/**
 * The latest page of messages (oldest first), plus calendar updates from the same
 * period, which the chat shows as "N events updated" cards between messages.
 */
export function loadChat(member: Member, before: number | null) {
	const rows = db
		.select()
		.from(chatMessages)
		.where(
			and(
				eq(chatMessages.calendarId, member.calendarId),
				before ? lt(chatMessages.createdAt, before) : undefined
			)
		)
		.orderBy(desc(chatMessages.createdAt))
		.limit(PAGE)
		.all()
		.reverse();

	const eventIds = [...new Set(rows.map((r) => r.eventId).filter((x): x is string => !!x))];
	const cards = eventIds.length
		? new Map(
				db
					.select({
						id: events.id,
						title: events.title,
						startAt: events.startAt,
						allDay: events.allDay,
						startTz: events.startTz,
						deletedAt: events.deletedAt
					})
					.from(events)
					.where(inArray(events.id, eventIds))
					.all()
					.map((e) => [e.id, e])
			)
		: new Map();
	const reacts = reactionsFor(
		'chat',
		rows.map((r) => r.id),
		new Set([member.id])
	);

	const messages: ClientChatMessage[] = rows.map((r) => {
		const card = r.eventId ? cards.get(r.eventId) : null;
		return {
			id: r.id,
			calendarId: r.calendarId,
			memberId: r.memberId,
			kind: r.kind,
			body: r.deletedAt ? '' : r.body,
			event:
				card && !card.deletedAt
					? {
							id: card.id,
							title: card.title,
							startAt: card.startAt,
							allDay: card.allDay,
							startTz: card.startTz
						}
					: null,
			reactions: r.deletedAt ? [] : (reacts.get(r.id) ?? []),
			createdAt: r.createdAt,
			editedAt: r.editedAt,
			deleted: !!r.deletedAt
		};
	});

	// Updates in the same window (a week back when the chat is quiet)
	const since =
		messages.length === PAGE ? messages[0].createdAt : Date.now() - 7 * 24 * 60 * 60 * 1000;
	const until = before ?? Date.now() + 60_000;
	const updates: ClientActivity[] = db
		.select({ a: activities, title: events.title, kind: events.kind, deleted: events.deletedAt })
		.from(activities)
		.leftJoin(events, eq(events.id, activities.eventId))
		.where(
			and(
				eq(activities.calendarId, member.calendarId),
				inArray(activities.type, [
					'event_created',
					'event_updated',
					'event_deleted',
					'memo_created',
					'memo_updated',
					'memo_deleted'
				]),
				isNull(activities.deletedAt),
				gte(activities.createdAt, since),
				lt(activities.createdAt, until)
			)
		)
		.orderBy(asc(activities.createdAt))
		.limit(300)
		.all()
		.map(({ a, title, kind, deleted }) => toClientActivity(a, { title, kind, deleted: !!deleted }));

	return {
		messages,
		updates,
		hasMore: rows.length === PAGE,
		readSince: getReadMarker(member.id, 'chat')
	};
}

export function unreadChat(member: Member): number {
	return db
		.select({ n: sql<number>`count(*)` })
		.from(chatMessages)
		.where(
			and(
				eq(chatMessages.calendarId, member.calendarId),
				gt(chatMessages.createdAt, getReadMarker(member.id, 'chat')),
				ne(chatMessages.memberId, member.id),
				isNull(chatMessages.deletedAt)
			)
		)
		.get()!.n;
}
