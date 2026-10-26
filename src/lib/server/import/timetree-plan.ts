/**
 * Turns a TimeTree calendar export (one JSON file per calendar, as written by
 * timetree-json-export / the TimeTree web API) into a validated import plan.
 * Pure: no database access, so it can run as a dry run and be unit tested.
 */
import { z } from 'zod';
import { isValidTimeZone } from '#lib/dates.js';
import { LIMITS } from '#lib/server/events-limits.js';

const id = z.union([z.number(), z.string()]).transform(String);
const color = z
	.union([z.number(), z.string()])
	.transform((c) =>
		(typeof c === 'number' ? `#${c.toString(16).padStart(6, '0')}` : c).toUpperCase()
	);

const ttLabel = z.object({ id, name: z.string().nullish(), color, order: z.number().nullish() });
const ttUser = z.object({
	user_id: id.nullish(),
	id: id.nullish(),
	name: z.string().nullish(),
	deactivated_at: z.number().nullish()
});
const ttEvent = z.object({
	uuid: z.string().min(1),
	category: z.number().nullish(),
	type: z.number().nullish(),
	author_id: id.nullish(),
	title: z.string().nullish(),
	all_day: z.boolean().nullish(),
	start_at: z.number(),
	start_timezone: z.string().nullish(),
	end_at: z.number().nullish(),
	end_timezone: z.string().nullish(),
	label_id: z.union([z.number(), z.string()]).nullish(),
	location: z.string().nullish(),
	location_lat: z.union([z.number(), z.string()]).nullish(),
	location_lon: z.union([z.number(), z.string()]).nullish(),
	url: z.string().nullish(),
	note: z.string().nullish(),
	attendees: z.array(id).nullish(),
	recurrences: z.array(z.string()).nullish(),
	recurring_uuid: z.string().nullish(),
	parent_id: z.string().nullish(),
	alerts: z.array(z.number()).nullish(),
	deactivated_at: z.number().nullish(),
	created_at: z.number().nullish(),
	updated_at: z.number().nullish()
});

export const timeTreeFile = z.object({
	calendar: z.object({
		id,
		name: z.string().nullish(),
		author_id: id.nullish(),
		deactivated_at: z.number().nullish(),
		calendar_labels: z.array(ttLabel).nullish(),
		calendar_users: z.array(ttUser).nullish()
	}),
	// Top-level label map: { "1": { name, color } }
	labels: z.record(z.string(), z.object({ name: z.string().nullish(), color })).nullish(),
	events: z.array(z.unknown())
});

export type PlannedEvent = {
	externalUuid: string;
	kind: 'event' | 'memo';
	title: string;
	allDay: boolean;
	startAt: number;
	endAt: number;
	startTz: string;
	endTz: string;
	locationName: string;
	locationLat: number | null;
	locationLon: number | null;
	url: string;
	note: string;
	labelExternalId: number | null;
	recurrence: string[];
	parentUuid: string | null;
	alerts: number[];
	attendeeExternalIds: string[];
	authorExternalId: string | null;
	createdAt: number;
	updatedAt: number;
};

export type ImportPlan = {
	source: { id: string; name: string; deactivated: boolean };
	labels: { externalId: number; name: string; color: string }[];
	users: { externalId: string; name: string; eventCount: number }[];
	events: PlannedEvent[];
	skipped: { deleted: number; birthdays: number; invalid: number };
	stats: {
		events: number;
		memos: number;
		allDay: number;
		withAlerts: number;
		withNotes: number;
		recurring: number;
		first: number | null;
		last: number | null;
	};
	warnings: string[];
};

const ALERT_MIN = -1440;
const ALERT_MAX = 60 * 24 * 31;
const RECURRENCE_LINE = /^(RRULE|EXDATE|RDATE)[:;]/i;

function toCoord(v: number | string | null | undefined, max: number): number | null {
	if (v == null || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

export function planTimeTreeImport(input: unknown): ImportPlan {
	const parsed = timeTreeFile.safeParse(input);
	if (!parsed.success) {
		throw new Error(
			`This doesn't look like a TimeTree calendar export (${parsed.error.issues[0]?.path.join('.') || 'root'}: ${parsed.error.issues[0]?.message}).`
		);
	}
	const file = parsed.data;
	const warnings: string[] = [];

	// Labels: prefer the calendar's own list (has order); fall back to the top-level map
	const labelSource = file.calendar.calendar_labels?.length
		? [...file.calendar.calendar_labels]
				.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
				.map((l) => ({ externalId: Number(l.id), name: l.name ?? '', color: l.color }))
		: Object.entries(file.labels ?? {})
				.map(([k, l]) => ({ externalId: Number(k), name: l.name ?? '', color: l.color }))
				.sort((a, b) => a.externalId - b.externalId);
	const labels = labelSource
		.filter((l) => Number.isFinite(l.externalId))
		.map((l) => ({
			...l,
			color: /^#[0-9A-F]{6}$/.test(l.color) ? l.color : '#9AA3A0',
			name: l.name.slice(0, 30)
		}));
	const labelIds = new Set(labels.map((l) => l.externalId));

	const skipped = { deleted: 0, birthdays: 0, invalid: 0 };
	const events: PlannedEvent[] = [];
	let truncated = 0;
	let badZones = 0;

	for (const raw of file.events) {
		const r = ttEvent.safeParse(raw);
		if (!r.success) {
			skipped.invalid++;
			continue;
		}
		const e = r.data;
		if (e.deactivated_at) {
			skipped.deleted++;
			continue;
		}
		// Birthdays are generated from member profiles in this app
		if (e.type === 1) {
			skipped.birthdays++;
			continue;
		}

		const allDay = !!e.all_day;
		let startTz = e.start_timezone ?? 'UTC';
		let endTz = e.end_timezone ?? startTz;
		if (!isValidTimeZone(startTz)) {
			startTz = 'UTC';
			badZones++;
		}
		if (!isValidTimeZone(endTz)) endTz = startTz;

		let title = (e.title ?? '').trim() || 'Untitled';
		if (title.length > LIMITS.title) {
			title = title.slice(0, LIMITS.title);
			truncated++;
		}
		const endAt = Math.max(e.end_at ?? e.start_at, e.start_at);
		const labelId = e.label_id == null ? null : Number(e.label_id);

		events.push({
			externalUuid: e.uuid,
			kind: e.category === 2 ? 'memo' : 'event',
			title,
			allDay,
			startAt: e.start_at,
			endAt,
			startTz: allDay ? 'UTC' : startTz,
			endTz: allDay ? 'UTC' : endTz,
			locationName: (e.location ?? '').slice(0, LIMITS.location),
			locationLat: toCoord(e.location_lat, 90),
			locationLon: toCoord(e.location_lon, 180),
			url: /^https?:\/\//i.test(e.url ?? '') ? e.url!.slice(0, LIMITS.url) : '',
			note: (e.note ?? '').slice(0, LIMITS.note),
			labelExternalId: labelId != null && labelIds.has(labelId) ? labelId : null,
			recurrence: (e.recurrences ?? []).filter((line) => RECURRENCE_LINE.test(line)),
			parentUuid: e.parent_id || e.recurring_uuid || null,
			alerts: [
				...new Set(
					(e.alerts ?? []).filter((m) => Number.isInteger(m) && m >= ALERT_MIN && m <= ALERT_MAX)
				)
			]
				.sort((a, b) => a - b)
				.slice(0, LIMITS.alerts),
			attendeeExternalIds: [...new Set(e.attendees ?? [])],
			authorExternalId: e.author_id ?? null,
			createdAt: e.created_at ?? Date.now(),
			updatedAt: e.updated_at ?? e.created_at ?? Date.now()
		});
	}
	if (truncated)
		warnings.push(
			`${truncated} titles were longer than ${LIMITS.title} characters and were shortened.`
		);
	if (badZones)
		warnings.push(`${badZones} events had an unknown time zone and were treated as UTC.`);
	if (skipped.invalid)
		warnings.push(`${skipped.invalid} entries were not readable as events and will be skipped.`);
	const unknownParents = events.filter(
		(e) => e.parentUuid && !events.some((p) => p.externalUuid === e.parentUuid)
	).length;
	if (unknownParents)
		warnings.push(
			`${unknownParents} repeat exceptions refer to a missing series and will import as standalone events.`
		);

	// Everyone mentioned: calendar members plus any attendee/author ids
	const names = new Map<string, string>();
	for (const u of file.calendar.calendar_users ?? []) {
		const key = u.user_id ?? u.id;
		if (key) names.set(key, u.name ?? '');
	}
	const counts = new Map<string, number>();
	for (const e of events) {
		for (const a of e.attendeeExternalIds) counts.set(a, (counts.get(a) ?? 0) + 1);
		if (e.authorExternalId && !counts.has(e.authorExternalId)) counts.set(e.authorExternalId, 0);
	}
	for (const key of counts.keys()) if (!names.has(key)) names.set(key, '');
	const users = [...names.entries()]
		.map(([externalId, name]) => ({ externalId, name, eventCount: counts.get(externalId) ?? 0 }))
		.sort((a, b) => b.eventCount - a.eventCount);

	const dated = events.filter((e) => e.kind === 'event');
	return {
		source: {
			id: file.calendar.id,
			name: (file.calendar.name ?? '').trim() || 'TimeTree calendar',
			deactivated: !!file.calendar.deactivated_at
		},
		labels,
		users,
		events,
		skipped,
		stats: {
			events: dated.length,
			memos: events.length - dated.length,
			allDay: dated.filter((e) => e.allDay).length,
			withAlerts: events.filter((e) => e.alerts.length).length,
			withNotes: events.filter((e) => e.note).length,
			recurring: events.filter((e) => e.recurrence.length).length,
			first: dated.length ? Math.min(...dated.map((e) => e.startAt)) : null,
			last: dated.length ? Math.max(...dated.map((e) => e.endAt)) : null
		},
		warnings
	};
}
