/**
 * Memos are undated items (TimeTree's "Keep"): stored as events with kind 'memo'
 * and no start/end, ordered by `memoOrder` within a calendar.
 */
import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { dateToUtcMs, isValidTimeZone, zonedToUtc } from '#lib/dates.js';
import { logActivity, type Member } from '#lib/server/calendars.js';
import { db } from '#lib/server/db/index.js';
import { events } from '#lib/server/db/schema.js';
import { LIMITS } from '#lib/server/events-limits.js';
import { hydrate, validateRefs, writeChildren, type ChildInput } from '#lib/server/events.js';
import { deleteStoredFile } from '#lib/server/files.js';
import type { ClientEvent } from '#lib/types.js';

export const MAX_MEMOS = 1000;

export const memoInput = z.object({
	calendarId: z.string().min(1),
	title: z.string().trim().min(1, 'No title entered.').max(LIMITS.title, 'Title too long.'),
	note: z.string().max(LIMITS.note, 'Details too long.').default(''),
	url: z
		.string()
		.trim()
		.max(LIMITS.url)
		.refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Please enter a valid URL.')
		.default(''),
	labelId: z.string().nullable().default(null),
	checklist: z
		.array(
			z.object({
				id: z.string().optional(),
				text: z.string().trim().min(1).max(200),
				done: z.boolean().default(false)
			})
		)
		.max(100)
		.default([]),
	fileIds: z.array(z.string()).max(10).default([])
});
export type MemoInput = z.output<typeof memoInput>;

const children = (m: MemoInput): ChildInput => ({
	labelId: m.labelId,
	attendees: [],
	alerts: [],
	checklist: m.checklist,
	fileIds: m.fileIds
});

export function listMemos(calendarIds: string[], limit = 500): ClientEvent[] {
	if (!calendarIds.length) return [];
	const rows = db
		.select()
		.from(events)
		.where(
			and(
				inArray(events.calendarId, calendarIds),
				eq(events.kind, 'memo'),
				isNull(events.deletedAt)
			)
		)
		// One calendar: the order people arranged. Several: newest first.
		.orderBy(
			...(calendarIds.length === 1
				? [asc(events.memoOrder), desc(events.createdAt)]
				: [desc(events.updatedAt)])
		)
		.limit(limit)
		.all();
	return hydrate(rows);
}

export function getMemo(id: string): ClientEvent {
	const row = db
		.select()
		.from(events)
		.where(and(eq(events.id, id), eq(events.kind, 'memo'), isNull(events.deletedAt)))
		.get();
	if (!row) error(404, 'This memo was deleted.');
	return hydrate([row])[0];
}

export function createMemo(member: Member, userId: string, input: MemoInput): string {
	validateRefs(member.calendarId, children(input), userId);
	const count = db
		.select({ n: sql<number>`count(*)` })
		.from(events)
		.where(
			and(
				eq(events.calendarId, member.calendarId),
				eq(events.kind, 'memo'),
				isNull(events.deletedAt)
			)
		)
		.get()!.n;
	if (count >= MAX_MEMOS) error(400, 'You have exceeded the maximum number of memos.');
	return db.transaction((tx) => {
		// New memos go to the top
		const top =
			tx
				.select({ m: sql<number>`coalesce(min(memo_order), 0)` })
				.from(events)
				.where(and(eq(events.calendarId, member.calendarId), eq(events.kind, 'memo')))
				.get()?.m ?? 0;
		const row = tx
			.insert(events)
			.values({
				calendarId: member.calendarId,
				kind: 'memo',
				title: input.title,
				note: input.note,
				url: input.url,
				labelId: input.labelId,
				memoOrder: top - 1,
				createdByMemberId: member.id
			})
			.returning({ id: events.id })
			.get()!;
		writeChildren(tx, row.id, children(input), member.id);
		logActivity(tx, member.calendarId, member.id, 'memo_created', { title: input.title }, row.id);
		return row.id;
	});
}

export async function updateMemo(
	member: Member,
	userId: string,
	memo: ClientEvent,
	input: MemoInput
) {
	validateRefs(member.calendarId, children(input), userId, memo.id);
	const orphaned = db.transaction((tx) => {
		tx.update(events)
			.set({ title: input.title, note: input.note, url: input.url, labelId: input.labelId })
			.where(eq(events.id, memo.id))
			.run();
		const removed = writeChildren(tx, memo.id, children(input), member.id);
		const fields = [
			memo.title !== input.title && 'title',
			memo.note !== input.note && 'note',
			memo.url !== input.url && 'url',
			memo.labelId !== input.labelId && 'label',
			JSON.stringify(memo.checklist.map((c) => [c.text, c.done])) !==
				JSON.stringify(input.checklist.map((c) => [c.text, c.done])) && 'checklist',
			memo.files.map((f) => f.id).join() !== input.fileIds.join() && 'files'
		].filter(Boolean);
		if (fields.length)
			logActivity(
				tx,
				member.calendarId,
				member.id,
				'memo_updated',
				{ title: input.title, fields },
				memo.id
			);
		return removed;
	});
	for (const f of orphaned) await deleteStoredFile(f);
}

export function deleteMemo(member: Member, memo: ClientEvent) {
	db.transaction((tx) => {
		tx.update(events).set({ deletedAt: Date.now() }).where(eq(events.id, memo.id)).run();
		logActivity(tx, member.calendarId, member.id, 'memo_deleted', { title: memo.title }, memo.id);
	});
}

export function reorderMemos(member: Member, ids: string[]) {
	db.transaction((tx) => {
		ids.forEach((id, i) => {
			tx.update(events)
				.set({ memoOrder: i })
				.where(
					and(eq(events.id, id), eq(events.calendarId, member.calendarId), eq(events.kind, 'memo'))
				)
				.run();
		});
	});
}

export const scheduleInput = z
	.object({
		allDay: z.boolean(),
		date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
		startTime: z
			.string()
			.regex(/^\d{2}:\d{2}$/)
			.optional(),
		endTime: z
			.string()
			.regex(/^\d{2}:\d{2}$/)
			.optional(),
		tz: z.string().refine(isValidTimeZone)
	})
	.refine(
		(v) => v.allDay || (v.startTime && v.endTime && v.endTime >= v.startTime),
		'Choose a start and end time.'
	);

/** Give a memo a date, turning it into an event. */
export function memoToEvent(
	member: Member,
	memo: ClientEvent,
	when: z.output<typeof scheduleInput>
) {
	const startAt = when.allDay
		? dateToUtcMs(when.date)
		: zonedToUtc(when.date, when.startTime!, when.tz);
	const endAt = when.allDay ? startAt : zonedToUtc(when.date, when.endTime!, when.tz);
	const tz = when.allDay ? 'UTC' : when.tz;
	db.transaction((tx) => {
		tx.update(events)
			.set({
				kind: 'event',
				allDay: when.allDay,
				startAt,
				endAt,
				startTz: tz,
				endTz: tz,
				memoOrder: null
			})
			.where(eq(events.id, memo.id))
			.run();
		logActivity(
			tx,
			member.calendarId,
			member.id,
			'event_updated',
			{ title: memo.title, converted: 'event', fields: ['kind'] },
			memo.id
		);
	});
}

/** "Save as memo": drop the date (and any repeat) and keep everything else. */
export function eventToMemo(member: Member, event: ClientEvent) {
	db.transaction((tx) => {
		const top =
			tx
				.select({ m: sql<number>`coalesce(min(memo_order), 0)` })
				.from(events)
				.where(and(eq(events.calendarId, member.calendarId), eq(events.kind, 'memo')))
				.get()?.m ?? 0;
		tx.update(events)
			.set({
				kind: 'memo',
				startAt: null,
				endAt: null,
				recurrence: [],
				memoOrder: top - 1,
				pinnedAt: null,
				pinnedOccurrences: []
			})
			.where(eq(events.id, event.id))
			.run();
		logActivity(
			tx,
			member.calendarId,
			member.id,
			'memo_updated',
			{ title: event.title, converted: 'memo', fields: ['kind'] },
			event.id
		);
	});
}
