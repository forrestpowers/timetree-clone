import { error } from '@sveltejs/kit';
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { dateToUtcMs, isValidTimeZone, zonedToUtc } from '#lib/dates.js';
import {
	continueFrom,
	expandEvents,
	findOccurrence,
	fromWall,
	isRecurring,
	toWall,
	truncateBefore,
	withExdate
} from '#lib/recurrence.js';
import { db } from '#lib/server/db/index.js';
import {
	calendarMembers,
	eventAlerts,
	eventAttendees,
	eventChecklistItems,
	eventFiles,
	events,
	files,
	labels,
	virtualMembers
} from '#lib/server/db/schema.js';
import { logActivity, requireMember, type Member } from '#lib/server/calendars.js';
import { LIMITS } from '#lib/server/events-limits.js';
import { deleteStoredFile } from '#lib/server/files.js';
import type { ClientEvent } from '#lib/types.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);
const recurrenceLine = z
	.string()
	.max(1000)
	.regex(/^(RRULE|EXDATE|RDATE)[:;]/i, 'Invalid repeat rule');

export const MAX_CHECKLIST_ITEMS = 100;
export const MAX_FILES_PER_EVENT = 10;

export const eventInput = z
	.object({
		calendarId: z.string().min(1),
		title: z.string().trim().min(1, 'No title entered.').max(LIMITS.title, 'Title too long.'),
		allDay: z.boolean(),
		startDate: date,
		endDate: date,
		startTime: time.optional(),
		endTime: time.optional(),
		startTz: z.string().refine(isValidTimeZone, 'Unknown time zone'),
		endTz: z.string().refine(isValidTimeZone, 'Unknown time zone'),
		locationName: z.string().trim().max(LIMITS.location, 'Location name too long.').default(''),
		locationLat: z.number().min(-90).max(90).nullable().default(null),
		locationLon: z.number().min(-180).max(180).nullable().default(null),
		url: z
			.string()
			.trim()
			.max(LIMITS.url, 'URL too long.')
			.refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Please enter a valid URL.')
			.default(''),
		note: z.string().max(LIMITS.note, 'Details too long.').default(''),
		labelId: z.string().nullable().default(null),
		attendees: z
			.array(z.object({ id: z.string(), type: z.enum(['member', 'virtual']) }))
			.max(200)
			.default([]),
		alerts: z
			.array(
				z
					.number()
					.int()
					.min(-1440)
					.max(60 * 24 * 31)
			)
			.max(LIMITS.alerts)
			.default([]),
		recurrence: z.array(recurrenceLine).max(200).default([]),
		checklist: z
			.array(
				z.object({
					id: z.string().optional(),
					text: z.string().trim().min(1).max(200, 'Text entered in checklist is too long.'),
					done: z.boolean().default(false)
				})
			)
			.max(MAX_CHECKLIST_ITEMS)
			.default([]),
		fileIds: z.array(z.string()).max(MAX_FILES_PER_EVENT).default([]),
		dayCount: z
			.object({
				mode: z.enum(['until', 'since']),
				interval: z.enum(['none', 'weekly', 'monthly', 'yearly', 'hundred_days'])
			})
			.nullable()
			.default(null)
	})
	.transform((v, ctx) => {
		let startAt: number;
		let endAt: number;
		if (v.allDay) {
			startAt = dateToUtcMs(v.startDate);
			endAt = dateToUtcMs(v.endDate);
		} else {
			if (!v.startTime || !v.endTime) {
				ctx.addIssue({ code: 'custom', message: 'Start and end times are required.' });
				return z.NEVER;
			}
			startAt = zonedToUtc(v.startDate, v.startTime, v.startTz);
			endAt = zonedToUtc(v.endDate, v.endTime, v.endTz);
		}
		if (endAt < startAt) {
			ctx.addIssue({
				code: 'custom',
				message: 'The start date/time must be before the end date/time.'
			});
			return z.NEVER;
		}
		return {
			calendarId: v.calendarId,
			title: v.title,
			allDay: v.allDay,
			startAt,
			endAt,
			startTz: v.allDay ? 'UTC' : v.startTz,
			endTz: v.allDay ? 'UTC' : v.endTz,
			locationName: v.locationName,
			locationLat: v.locationLat,
			locationLon: v.locationLon,
			url: v.url,
			note: v.note,
			labelId: v.labelId,
			attendees: v.attendees,
			alerts: [...new Set(v.alerts)].sort((a, b) => a - b),
			recurrence: v.recurrence,
			checklist: v.checklist,
			fileIds: [...new Set(v.fileIds)],
			dayCount: v.dayCount
		};
	});

export type EventInput = z.output<typeof eventInput>;
export type EditScope = 'this' | 'future' | 'all';
type EventRow = typeof events.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function hydrate(rows: EventRow[]): ClientEvent[] {
	if (!rows.length) return [];
	const ids = rows.map((r) => r.id);
	const attendees = db
		.select()
		.from(eventAttendees)
		.where(inArray(eventAttendees.eventId, ids))
		.all();
	const alerts = db.select().from(eventAlerts).where(inArray(eventAlerts.eventId, ids)).all();
	const checklist = db
		.select()
		.from(eventChecklistItems)
		.where(inArray(eventChecklistItems.eventId, ids))
		.orderBy(asc(eventChecklistItems.sortOrder))
		.all();
	const attached = db
		.select({ eventId: eventFiles.eventId, file: files, sortOrder: eventFiles.sortOrder })
		.from(eventFiles)
		.innerJoin(files, eq(files.id, eventFiles.fileId))
		.where(inArray(eventFiles.eventId, ids))
		.orderBy(asc(eventFiles.sortOrder))
		.all();
	const attendeesBy = Map.groupBy(attendees, (a) => a.eventId);
	const alertsBy = Map.groupBy(alerts, (a) => a.eventId);
	const checklistBy = Map.groupBy(checklist, (c) => c.eventId);
	const filesBy = Map.groupBy(attached, (f) => f.eventId);
	return rows.map((e) => ({
		id: e.id,
		calendarId: e.calendarId,
		kind: e.kind,
		title: e.title,
		allDay: e.allDay,
		startAt: e.startAt,
		endAt: e.endAt,
		startTz: e.startTz,
		endTz: e.endTz,
		locationName: e.locationName,
		locationLat: e.locationLat,
		locationLon: e.locationLon,
		url: e.url,
		note: e.note,
		labelId: e.labelId,
		recurrence: e.recurrence,
		parentId: e.parentId,
		attendees: (attendeesBy.get(e.id) ?? []).map((a) => ({
			id: a.attendeeId,
			type: a.attendeeType
		})),
		alerts: (alertsBy.get(e.id) ?? []).map((a) => a.minutesBefore).sort((a, b) => a - b),
		checklist: (checklistBy.get(e.id) ?? []).map((c) => ({
			id: c.id,
			text: c.text,
			done: c.done,
			doneByMemberId: c.doneByMemberId
		})),
		files: (filesBy.get(e.id) ?? []).map((f) => ({
			id: f.file.id,
			name: f.file.originalName,
			mime: f.file.mime,
			size: f.file.size
		})),
		pinnedAt: e.pinnedAt,
		pinnedOccurrences: e.pinnedOccurrences,
		dayCount: e.dayCount ?? null,
		createdByMemberId: e.createdByMemberId,
		createdAt: e.createdAt,
		updatedAt: e.updatedAt
	}));
}

/** Events overlapping [from, to]. Repeating series are returned whole for client-side expansion. */
export function listEvents(calendarIds: string[], from: number, to: number): ClientEvent[] {
	if (!calendarIds.length) return [];
	const rows = db
		.select()
		.from(events)
		.where(
			and(
				inArray(events.calendarId, calendarIds),
				eq(events.kind, 'event'),
				isNull(events.deletedAt),
				or(
					and(lte(events.startAt, to), gte(events.endAt, from)),
					sql`json_array_length(${events.recurrence}) > 0 and ${events.startAt} <= ${to}`
				)
			)
		)
		.orderBy(asc(events.startAt))
		.all();
	return hydrate(rows);
}

export function getEvent(eventId: string): ClientEvent | null {
	const row = db
		.select()
		.from(events)
		.where(and(eq(events.id, eventId), isNull(events.deletedAt)))
		.get();
	return row ? hydrate([row])[0] : null;
}

function validateRefs(
	calendarId: string,
	input: EventInput,
	userId: string,
	existingEventId?: string
) {
	if (input.labelId) {
		const label = db.select().from(labels).where(eq(labels.id, input.labelId)).get();
		if (!label || label.calendarId !== calendarId) error(400, 'Unknown label');
	}
	const memberIds = input.attendees.filter((a) => a.type === 'member').map((a) => a.id);
	const virtualIds = input.attendees.filter((a) => a.type === 'virtual').map((a) => a.id);
	if (memberIds.length) {
		const found = db
			.select({ id: calendarMembers.id })
			.from(calendarMembers)
			.where(
				and(
					inArray(calendarMembers.id, memberIds),
					eq(calendarMembers.calendarId, calendarId),
					isNull(calendarMembers.removedAt)
				)
			)
			.all();
		if (found.length !== new Set(memberIds).size) error(400, 'Unknown attendee');
	}
	if (virtualIds.length) {
		const found = db
			.select({ id: virtualMembers.id })
			.from(virtualMembers)
			.where(
				and(
					inArray(virtualMembers.id, virtualIds),
					eq(virtualMembers.calendarId, calendarId),
					isNull(virtualMembers.deletedAt)
				)
			)
			.all();
		if (found.length !== new Set(virtualIds).size) error(400, 'Unknown attendee');
	}
	if (input.fileIds.length) {
		const rows = db.select().from(files).where(inArray(files.id, input.fileIds)).all();
		const alreadyAttached = new Set(
			existingEventId
				? db
						.select({ id: eventFiles.fileId })
						.from(eventFiles)
						.where(eq(eventFiles.eventId, existingEventId))
						.all()
						.map((r) => r.id)
				: []
		);
		for (const id of input.fileIds) {
			const f = rows.find((r) => r.id === id);
			// New files must be your own uploads for this calendar; existing ones may stay
			const ok =
				f &&
				f.kind === 'attachment' &&
				f.calendarId === calendarId &&
				(alreadyAttached.has(id) || f.ownerUserId === userId);
			if (!ok) error(400, 'Unknown attachment');
		}
	}
}

/** Replace attendees, alerts, checklist and attachments. Returns files no longer used anywhere. */
function writeChildren(tx: Tx, eventId: string, input: EventInput, memberId: string): string[] {
	tx.delete(eventAttendees).where(eq(eventAttendees.eventId, eventId)).run();
	tx.delete(eventAlerts).where(eq(eventAlerts.eventId, eventId)).run();
	const seen = new Set<string>();
	const attendees = input.attendees.filter((a) => !seen.has(a.id) && seen.add(a.id));
	if (attendees.length) {
		tx.insert(eventAttendees)
			.values(attendees.map((a) => ({ eventId, attendeeId: a.id, attendeeType: a.type })))
			.run();
	}
	if (input.alerts.length) {
		tx.insert(eventAlerts)
			.values(input.alerts.map((m) => ({ eventId, minutesBefore: m })))
			.run();
	}

	// Checklist: keep who ticked an item when it stays ticked
	const previous = new Map(
		tx
			.select()
			.from(eventChecklistItems)
			.where(eq(eventChecklistItems.eventId, eventId))
			.all()
			.map((c) => [c.id, c])
	);
	tx.delete(eventChecklistItems).where(eq(eventChecklistItems.eventId, eventId)).run();
	if (input.checklist.length) {
		tx.insert(eventChecklistItems)
			.values(
				input.checklist.map((c, i) => {
					const before = c.id ? previous.get(c.id) : undefined;
					const keep = before && before.done === c.done;
					return {
						id: before ? before.id : undefined,
						eventId,
						text: c.text,
						done: c.done,
						doneByMemberId: c.done ? (keep ? before.doneByMemberId : memberId) : null,
						doneAt: c.done ? (keep ? before.doneAt : Date.now()) : null,
						sortOrder: i
					};
				})
			)
			.run();
	}

	// Attachments
	const before = tx
		.select({ id: eventFiles.fileId })
		.from(eventFiles)
		.where(eq(eventFiles.eventId, eventId))
		.all()
		.map((r) => r.id);
	tx.delete(eventFiles).where(eq(eventFiles.eventId, eventId)).run();
	if (input.fileIds.length) {
		tx.insert(eventFiles)
			.values(input.fileIds.map((fileId, i) => ({ eventId, fileId, sortOrder: i })))
			.run();
	}
	const removed = before.filter((id) => !input.fileIds.includes(id));
	return removed.filter(
		(id) => !tx.select().from(eventFiles).where(eq(eventFiles.fileId, id)).get()
	);
}

function rowValues(input: EventInput) {
	return {
		title: input.title,
		allDay: input.allDay,
		startAt: input.startAt,
		endAt: input.endAt,
		startTz: input.startTz,
		endTz: input.endTz,
		locationName: input.locationName,
		locationLat: input.locationLat,
		locationLon: input.locationLon,
		url: input.url,
		note: input.note,
		labelId: input.labelId,
		recurrence: input.recurrence,
		dayCount: input.dayCount
	};
}

function insertEvent(
	tx: Tx,
	member: Member,
	input: EventInput,
	extra: Partial<typeof events.$inferInsert> = {}
) {
	const row = tx
		.insert(events)
		.values({
			calendarId: member.calendarId,
			kind: 'event',
			...rowValues(input),
			createdByMemberId: member.id,
			...extra
		})
		.returning({ id: events.id })
		.get()!;
	writeChildren(tx, row.id, input, member.id);
	return row.id;
}

export function createEvent(member: Member, input: EventInput, userId: string): string {
	validateRefs(member.calendarId, input, userId);
	return db.transaction((tx) => {
		const id = insertEvent(tx, member, input);
		if (input.labelId) {
			tx.update(calendarMembers)
				.set({ lastLabelId: input.labelId })
				.where(eq(calendarMembers.id, member.id))
				.run();
		}
		logActivity(tx, member.calendarId, member.id, 'event_created', { title: input.title }, id);
		return id;
	});
}

/** Which user-visible aspects changed, as named in the activity feed. */
function changedFields(before: ClientEvent, after: EventInput): string[] {
	const fields: string[] = [];
	if (before.title !== after.title) fields.push('title');
	if (
		before.allDay !== after.allDay ||
		before.startAt !== after.startAt ||
		before.endAt !== after.endAt ||
		before.startTz !== after.startTz ||
		before.endTz !== after.endTz
	)
		fields.push('date');
	if (before.recurrence.join('\n') !== after.recurrence.join('\n')) fields.push('repeat');
	if (before.locationName !== after.locationName || before.locationLat !== after.locationLat)
		fields.push('location');
	if (before.url !== after.url) fields.push('url');
	if (before.note !== after.note) fields.push('note');
	if (before.labelId !== after.labelId) fields.push('label');
	const ids = (list: { id: string }[]) =>
		list
			.map((a) => a.id)
			.sort()
			.join();
	if (ids(before.attendees) !== ids(after.attendees)) fields.push('attendees');
	if (before.alerts.join() !== after.alerts.join()) fields.push('alerts');
	const list = (c: { text: string; done: boolean }[]) =>
		JSON.stringify(c.map((x) => [x.text, x.done]));
	if (list(before.checklist) !== list(after.checklist)) fields.push('checklist');
	if (before.files.map((f) => f.id).join() !== after.fileIds.join()) fields.push('files');
	if (JSON.stringify(before.dayCount) !== JSON.stringify(after.dayCount)) fields.push('day_count');
	return fields;
}

function dateDiff(
	before: { allDay: boolean; startAt: number | null; endAt: number | null; startTz: string },
	after: EventInput
) {
	return {
		before: {
			allDay: before.allDay,
			startAt: before.startAt,
			endAt: before.endAt,
			tz: before.startTz
		},
		after: { allDay: after.allDay, startAt: after.startAt, endAt: after.endAt, tz: after.startTz }
	};
}

/**
 * Save an edit. For repeating events, `occurrenceStartAt` says which occurrence was
 * edited and `scope` whether the change applies to it alone, it and later ones, or all.
 */
export async function updateEvent(
	member: Member,
	userId: string,
	series: ClientEvent,
	input: EventInput,
	scope: EditScope = 'all',
	occurrenceStartAt: number | null = null
): Promise<string> {
	validateRefs(member.calendarId, input, userId, series.id);
	const repeating = isRecurring(series) && occurrenceStartAt != null;
	if (repeating && !findOccurrence(series, occurrenceStartAt))
		error(409, 'This occurrence no longer exists.');
	const firstOccurrence = repeating && occurrenceStartAt === series.startAt;
	const effectiveScope: EditScope = !repeating
		? 'all'
		: scope === 'future' && firstOccurrence
			? 'all'
			: scope;
	const occurrence = repeating
		? {
				...series,
				startAt: occurrenceStartAt,
				endAt: occurrenceStartAt + ((series.endAt ?? series.startAt!) - series.startAt!)
			}
		: series;

	const { id, orphaned } = db.transaction((tx) => {
		if (effectiveScope === 'this') {
			// Detach this occurrence: exclude it from the series and save it as its own event
			tx.update(events)
				.set({ recurrence: withExdate(series, occurrenceStartAt!) })
				.where(eq(events.id, series.id))
				.run();
			const childId = insertEvent(
				tx,
				member,
				{ ...input, recurrence: [] },
				{
					parentId: series.id,
					recurrenceStartAt: occurrenceStartAt,
					createdByMemberId: series.createdByMemberId
				}
			);
			const fields = changedFields(occurrence, { ...input, recurrence: occurrence.recurrence });
			logActivity(
				tx,
				member.calendarId,
				member.id,
				'event_updated',
				{
					title: input.title,
					fields,
					scope: 'this',
					...(fields.includes('date') && dateDiff(occurrence, input))
				},
				childId
			);
			return { id: childId, orphaned: [] as string[] };
		}

		if (effectiveScope === 'future') {
			// End the old series before this occurrence and start a new one here
			const ruleChanged = input.recurrence.join('\n') !== series.recurrence.join('\n');
			tx.update(events)
				.set({ recurrence: truncateBefore(series, occurrenceStartAt!) })
				.where(eq(events.id, series.id))
				.run();
			const newId = insertEvent(
				tx,
				member,
				{
					...input,
					recurrence: ruleChanged ? input.recurrence : continueFrom(series, occurrenceStartAt!)
				},
				{
					parentId: series.id,
					createdByMemberId: series.createdByMemberId
				}
			);
			const fields = changedFields(occurrence, input);
			logActivity(
				tx,
				member.calendarId,
				member.id,
				'event_updated',
				{
					title: input.title,
					fields,
					scope: 'future',
					...(fields.includes('date') && dateDiff(occurrence, input))
				},
				newId
			);
			return { id: newId, orphaned: [] as string[] };
		}

		// 'all': when an occurrence was edited, move the series start by the same amount
		let values = rowValues(input);
		if (repeating && occurrenceStartAt !== series.startAt) {
			const tz = input.allDay ? 'UTC' : input.startTz;
			const shift =
				toWall(input.startAt, tz) -
				toWall(occurrenceStartAt!, series.allDay ? 'UTC' : series.startTz);
			const startAt = fromWall(toWall(series.startAt!, tz) + shift, tz);
			values = { ...values, startAt, endAt: startAt + (input.endAt - input.startAt) };
		}
		const fields = changedFields(occurrence, input);
		if (!fields.length) return { id: series.id, orphaned: [] as string[] };
		tx.update(events).set(values).where(eq(events.id, series.id)).run();
		const orphaned = writeChildren(tx, series.id, input, member.id);
		logActivity(
			tx,
			member.calendarId,
			member.id,
			'event_updated',
			{ title: input.title, fields, ...(fields.includes('date') && dateDiff(occurrence, input)) },
			series.id
		);
		return { id: series.id, orphaned };
	});
	for (const f of orphaned) await deleteStoredFile(f);
	return id;
}

export async function deleteEvent(
	member: Member,
	event: ClientEvent,
	scope: EditScope = 'all',
	occurrenceStartAt: number | null = null
) {
	const repeating = isRecurring(event) && occurrenceStartAt != null;
	const effective: EditScope = !repeating
		? 'all'
		: scope === 'future' && occurrenceStartAt === event.startAt
			? 'all'
			: scope;
	db.transaction((tx) => {
		if (effective === 'this') {
			tx.update(events)
				.set({ recurrence: withExdate(event, occurrenceStartAt!) })
				.where(eq(events.id, event.id))
				.run();
		} else if (effective === 'future') {
			tx.update(events)
				.set({ recurrence: truncateBefore(event, occurrenceStartAt!) })
				.where(eq(events.id, event.id))
				.run();
		} else {
			tx.update(events).set({ deletedAt: Date.now() }).where(eq(events.id, event.id)).run();
		}
		logActivity(
			tx,
			member.calendarId,
			member.id,
			'event_deleted',
			{ title: event.title, scope: effective, occurrenceStartAt },
			event.id
		);
	});
}

export function setChecklistItem(
	member: Member,
	event: ClientEvent,
	itemId: string,
	done: boolean
) {
	const item = event.checklist.find((c) => c.id === itemId);
	if (!item) error(404, 'Checklist item not found');
	if (item.done === done) return;
	db.transaction((tx) => {
		tx.update(eventChecklistItems)
			.set({ done, doneByMemberId: done ? member.id : null, doneAt: done ? Date.now() : null })
			.where(eq(eventChecklistItems.id, itemId))
			.run();
		tx.update(events).set({ updatedAt: Date.now() }).where(eq(events.id, event.id)).run();
		logActivity(
			tx,
			member.calendarId,
			member.id,
			'event_updated',
			{ title: event.title, fields: ['checklist'], item: item.text, done },
			event.id
		);
	});
}

/** Pin or unpin: all occurrences, or just one occurrence of a repeating event. */
export function setPinned(event: ClientEvent, pinned: boolean, occurrenceStartAt: number | null) {
	if (occurrenceStartAt != null && isRecurring(event)) {
		const set = new Set(event.pinnedOccurrences);
		if (pinned) set.add(occurrenceStartAt);
		else set.delete(occurrenceStartAt);
		db.update(events)
			.set({ pinnedOccurrences: [...set] })
			.where(eq(events.id, event.id))
			.run();
	} else {
		db.update(events)
			.set({
				pinnedAt: pinned ? Date.now() : null,
				pinnedOccurrences: pinned ? event.pinnedOccurrences : []
			})
			.where(eq(events.id, event.id))
			.run();
	}
}

/**
 * Copy an event (or one occurrence) to other dates in its calendar, or to another
 * calendar. Copies never repeat. Attachments only travel within the same calendar.
 */
export function copyEvent(
	member: Member,
	source: ClientEvent,
	occurrenceStartAt: number | null,
	target: { calendarMember: Member; dates: string[] | null }
): string[] {
	const occ =
		occurrenceStartAt != null && isRecurring(source)
			? findOccurrence(source, occurrenceStartAt)
			: source;
	if (!occ || occ.startAt == null) error(404, 'Event not found');
	const sameCalendar = target.calendarMember.calendarId === source.calendarId;
	const tz = occ.allDay ? 'UTC' : occ.startTz;
	const startWall = toWall(occ.startAt, tz);
	const wallDuration = toWall(occ.endAt ?? occ.startAt, tz) - startWall;
	const timeOfDay = ((startWall % 86_400_000) + 86_400_000) % 86_400_000;

	// Labels are per calendar: match by color in the target
	let labelId = occ.labelId;
	if (!sameCalendar) {
		const color = occ.labelId
			? db.select().from(labels).where(eq(labels.id, occ.labelId)).get()?.color
			: null;
		const targetLabels = db
			.select()
			.from(labels)
			.where(eq(labels.calendarId, target.calendarMember.calendarId))
			.orderBy(asc(labels.sortOrder))
			.all();
		labelId =
			(color && targetLabels.find((l) => l.color.toLowerCase() === color.toLowerCase())?.id) ||
			targetLabels[0]?.id ||
			null;
	}

	const starts = (target.dates ?? [null]).map((d) =>
		d ? fromWall(dateToUtcMs(d) + timeOfDay, tz) : occ.startAt!
	);
	return db.transaction((tx) =>
		starts.map((startAt) => {
			const endAt = fromWall(toWall(startAt, tz) + wallDuration, tz);
			const input: EventInput = {
				calendarId: target.calendarMember.calendarId,
				title: occ.title,
				allDay: occ.allDay,
				startAt,
				endAt,
				startTz: occ.startTz,
				endTz: occ.endTz,
				locationName: occ.locationName,
				locationLat: occ.locationLat,
				locationLon: occ.locationLon,
				url: occ.url,
				note: occ.note,
				labelId,
				attendees: sameCalendar
					? occ.attendees
					: [{ id: target.calendarMember.id, type: 'member' }],
				alerts: occ.alerts,
				recurrence: [],
				checklist: occ.checklist.map((c) => ({ text: c.text, done: false })),
				fileIds: sameCalendar ? occ.files.map((f) => f.id) : [],
				dayCount: occ.dayCount
			};
			const id = insertEvent(tx, target.calendarMember, input);
			logActivity(
				tx,
				target.calendarMember.calendarId,
				member.id,
				'event_created',
				{ title: occ.title, copiedFrom: source.id },
				id
			);
			return id;
		})
	);
}

/** Recently used event shapes in a calendar, for one-tap creation. */
export function eventTemplates(calendarId: string, memberId: string, limit = 8) {
	const rows = db
		.select({
			title: events.title,
			allDay: events.allDay,
			startAt: events.startAt,
			endAt: events.endAt,
			startTz: events.startTz,
			labelId: events.labelId
		})
		.from(events)
		.where(
			and(
				eq(events.calendarId, calendarId),
				eq(events.kind, 'event'),
				isNull(events.deletedAt),
				eq(events.createdByMemberId, memberId)
			)
		)
		.orderBy(sql`${events.createdAt} desc`)
		.limit(300)
		.all();
	const seen = new Map<
		string,
		{
			title: string;
			allDay: boolean;
			startTime: string | null;
			endTime: string | null;
			days: number;
			tz: string;
			labelId: string | null;
			uses: number;
		}
	>();
	for (const r of rows) {
		if (r.startAt == null) continue;
		const tz = r.allDay ? 'UTC' : r.startTz;
		const sw = toWall(r.startAt, tz);
		const ew = toWall(r.endAt ?? r.startAt, tz);
		const hm = (w: number) => new Date(w).toISOString().slice(11, 16);
		const days = Math.round(Math.floor(ew / 86_400_000) - Math.floor(sw / 86_400_000));
		const shape = {
			title: r.title,
			allDay: r.allDay,
			startTime: r.allDay ? null : hm(sw),
			endTime: r.allDay ? null : hm(ew),
			days,
			tz,
			labelId: r.labelId
		};
		const key = JSON.stringify([
			shape.title,
			shape.allDay,
			shape.startTime,
			shape.endTime,
			shape.days
		]);
		const hit = seen.get(key);
		if (hit) hit.uses++;
		else seen.set(key, { ...shape, uses: 1 });
	}
	return [...seen.values()].sort((a, b) => b.uses - a.uses).slice(0, limit);
}

/** Events that attendees of a proposed event are already in at the same time. */
export function findConflicts(
	calendarIds: string[],
	attendeeIds: string[],
	startAt: number,
	endAt: number,
	excludeEventId: string | null
) {
	if (!attendeeIds.length || endAt <= startAt) return [];
	const candidates = listEvents(calendarIds, startAt, endAt).filter(
		(e) => e.id !== excludeEventId && !e.allDay
	);
	// Events of a day or longer ("in town", trips) behave like all-day events and aren't conflicts
	const DAY = 24 * 60 * 60 * 1000;
	return expandEvents(candidates, startAt, endAt)
		.filter(
			(o) =>
				o.startAt! < endAt &&
				(o.endAt ?? o.startAt!) > startAt &&
				(o.endAt ?? o.startAt!) - o.startAt! < DAY
		)
		.flatMap((o) =>
			o.attendees
				.filter((a) => attendeeIds.includes(a.id))
				.map((a) => ({
					attendeeId: a.id,
					eventId: o.id,
					title: o.title,
					startAt: o.startAt!,
					endAt: o.endAt!
				}))
		);
}

/** The event plus the caller's membership in its calendar (404 if either is missing). */
export function loadEvent(id: string, userId: string) {
	const event = getEvent(id);
	if (!event) error(404, 'This event was deleted.');
	return { event, member: requireMember(userId, event.calendarId) };
}
