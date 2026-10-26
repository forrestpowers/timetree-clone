import { error } from '@sveltejs/kit';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { requireMember, logActivity } from '#lib/server/calendars.js';
import { db } from '#lib/server/db/index.js';
import { activities, chatMessages, events, reactions } from '#lib/server/db/schema.js';
import { publish } from '#lib/server/live.js';
import type { ReactionSummary } from '#lib/types.js';

export const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🎉', '👀'];
export const LIKE = '❤️';
const MAX_PER_TARGET = 20;

type TargetType = 'event' | 'comment' | 'chat';

/** The calendar a reaction target belongs to (404 if it's gone). */
function targetCalendar(
	type: TargetType,
	id: string
): { calendarId: string; eventId: string | null } {
	if (type === 'event') {
		const e = db
			.select({ c: events.calendarId })
			.from(events)
			.where(and(eq(events.id, id), isNull(events.deletedAt)))
			.get();
		if (e) return { calendarId: e.c, eventId: id };
	} else if (type === 'comment') {
		const a = db
			.select({ c: activities.calendarId, e: activities.eventId })
			.from(activities)
			.where(
				and(eq(activities.id, id), eq(activities.type, 'comment'), isNull(activities.deletedAt))
			)
			.get();
		if (a) return { calendarId: a.c, eventId: a.e };
	} else {
		const m = db
			.select({ c: chatMessages.calendarId })
			.from(chatMessages)
			.where(and(eq(chatMessages.id, id), isNull(chatMessages.deletedAt)))
			.get();
		if (m) return { calendarId: m.c, eventId: null };
	}
	error(404, 'Not found');
}

export function summarize(
	rows: { emoji: string; memberId: string }[],
	myMemberIds: Set<string>
): ReactionSummary[] {
	const by = new Map<string, ReactionSummary>();
	for (const r of rows) {
		const s = by.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, memberIds: [] };
		s.count++;
		s.memberIds.push(r.memberId);
		if (myMemberIds.has(r.memberId)) s.mine = true;
		by.set(r.emoji, s);
	}
	// Likes first, then palette order
	return [...by.values()].sort(
		(a, b) => REACTION_EMOJIS.indexOf(a.emoji) - REACTION_EMOJIS.indexOf(b.emoji)
	);
}

/** Reactions grouped per target id. */
export function reactionsFor(
	type: TargetType,
	ids: string[],
	myMemberIds: Set<string>
): Map<string, ReactionSummary[]> {
	const out = new Map<string, ReactionSummary[]>();
	if (!ids.length) return out;
	const rows = db
		.select({ targetId: reactions.targetId, emoji: reactions.emoji, memberId: reactions.memberId })
		.from(reactions)
		.where(and(eq(reactions.targetType, type), inArray(reactions.targetId, ids)))
		.orderBy(reactions.createdAt)
		.all();
	for (const [id, list] of Map.groupBy(rows, (r) => r.targetId))
		out.set(id, summarize(list, myMemberIds));
	return out;
}

/** Add or remove the caller's reaction. Returns whether it is now on. */
export function toggleReaction(
	userId: string,
	type: TargetType,
	targetId: string,
	emoji: string
): boolean {
	if (!REACTION_EMOJIS.includes(emoji)) error(400, 'Unsupported reaction');
	const { calendarId, eventId } = targetCalendar(type, targetId);
	const member = requireMember(userId, calendarId);
	const key = and(
		eq(reactions.targetType, type),
		eq(reactions.targetId, targetId),
		eq(reactions.memberId, member.id),
		eq(reactions.emoji, emoji)
	);
	const existing = db.select().from(reactions).where(key).get();
	const on = !existing;
	db.transaction((tx) => {
		if (existing) {
			tx.delete(reactions).where(key).run();
			// Taking back a like also removes it from the activity feed
			if (type === 'event' && emoji === LIKE) {
				tx.update(activities)
					.set({ deletedAt: Date.now() })
					.where(
						and(
							eq(activities.eventId, targetId),
							eq(activities.type, 'like'),
							eq(activities.actorMemberId, member.id),
							isNull(activities.deletedAt)
						)
					)
					.run();
			}
		} else {
			const count = tx
				.select()
				.from(reactions)
				.where(and(eq(reactions.targetType, type), eq(reactions.targetId, targetId)))
				.all().length;
			if (count >= MAX_PER_TARGET) error(400, 'Maximum number of reactions reached.');
			tx.insert(reactions)
				.values({ targetType: type, targetId, memberId: member.id, emoji, calendarId })
				.run();
			if (type === 'event' && emoji === LIKE)
				logActivity(tx, calendarId, member.id, 'like', {}, targetId);
		}
	});
	publish({
		calendarId,
		kinds: type === 'chat' ? ['chat'] : ['event', 'feed'],
		eventId,
		actorMemberId: member.id
	});
	return on;
}
