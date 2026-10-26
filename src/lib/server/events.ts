import { error } from '@sveltejs/kit';
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { dateToUtcMs, isValidTimeZone, zonedToUtc } from '#lib/dates.js';
import { db } from '#lib/server/db/index.js';
import {
	calendarMembers,
	eventAlerts,
	eventAttendees,
	events,
	labels,
	virtualMembers
} from '#lib/server/db/schema.js';
import { logActivity, type Member } from '#lib/server/calendars.js';
import { LIMITS } from '#lib/server/events-limits.js';
import type { ClientEvent } from '#lib/types.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);

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
			.default([])
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
			alerts: [...new Set(v.alerts)].sort((a, b) => a - b)
		};
	});

export type EventInput = z.output<typeof eventInput>;
type EventRow = typeof events.$inferSelect;

function hydrate(rows: EventRow[]): ClientEvent[] {
	if (!rows.length) return [];
	const ids = rows.map((r) => r.id);
	const attendees = db
		.select()
		.from(eventAttendees)
		.where(inArray(eventAttendees.eventId, ids))
		.all();
	const alerts = db.select().from(eventAlerts).where(inArray(eventAlerts.eventId, ids)).all();
	const attendeesBy = Map.groupBy(attendees, (a) => a.eventId);
	const alertsBy = Map.groupBy(alerts, (a) => a.eventId);
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
		attendees: (attendeesBy.get(e.id) ?? []).map((a) => ({
			id: a.attendeeId,
			type: a.attendeeType
		})),
		alerts: (alertsBy.get(e.id) ?? []).map((a) => a.minutesBefore).sort((a, b) => a - b),
		createdByMemberId: e.createdByMemberId,
		createdAt: e.createdAt,
		updatedAt: e.updatedAt
	}));
}

/** Events overlapping [from, to]. Recurring series are returned whole for client-side expansion. */
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

function validateRefs(calendarId: string, input: EventInput) {
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
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function writeChildren(tx: Tx, eventId: string, input: EventInput) {
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
}

export function createEvent(member: Member, input: EventInput): string {
	validateRefs(member.calendarId, input);
	return db.transaction((tx) => {
		const row = tx
			.insert(events)
			.values({
				calendarId: member.calendarId,
				kind: 'event',
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
				createdByMemberId: member.id
			})
			.returning({ id: events.id })
			.get();
		writeChildren(tx, row.id, input);
		if (input.labelId) {
			tx.update(calendarMembers)
				.set({ lastLabelId: input.labelId })
				.where(eq(calendarMembers.id, member.id))
				.run();
		}
		logActivity(tx, member.calendarId, member.id, 'event_created', { title: input.title }, row.id);
		return row.id;
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
	return fields;
}

export function updateEvent(member: Member, before: ClientEvent, input: EventInput) {
	validateRefs(member.calendarId, input);
	const fields = changedFields(before, input);
	if (!fields.length) return;
	db.transaction((tx) => {
		tx.update(events)
			.set({
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
				labelId: input.labelId
			})
			.where(eq(events.id, before.id))
			.run();
		writeChildren(tx, before.id, input);
		logActivity(
			tx,
			member.calendarId,
			member.id,
			'event_updated',
			{
				title: input.title,
				fields,
				...(fields.includes('date') && {
					before: {
						allDay: before.allDay,
						startAt: before.startAt,
						endAt: before.endAt,
						tz: before.startTz
					},
					after: {
						allDay: input.allDay,
						startAt: input.startAt,
						endAt: input.endAt,
						tz: input.startTz
					}
				})
			},
			before.id
		);
	});
}

export function deleteEvent(member: Member, event: ClientEvent) {
	db.transaction((tx) => {
		tx.update(events).set({ deletedAt: Date.now() }).where(eq(events.id, event.id)).run();
		logActivity(
			tx,
			member.calendarId,
			member.id,
			'event_deleted',
			{ title: event.title },
			event.id
		);
	});
}
