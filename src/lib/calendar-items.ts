/**
 * Turns server data into what the calendar views draw: expanded occurrences,
 * generated birthdays, pin state and folded duplicates.
 */
import { DAY_MS, dateToUtcMs, dayKey, timeOf, utcMsToDate } from '#lib/dates.js';
import { isPinned } from '#lib/event-utils.js';
import { expandEvents, fromWall, toWall, type Occurrence } from '#lib/recurrence.js';
import type {
	ClientCalendar,
	ClientEvent,
	ClientLabel,
	ClientMember,
	ClientVirtualMember
} from '#lib/types.js';

export const BIRTHDAY_COLOR = '#F35F8C';
export const NO_LABEL_COLOR = '#9AA3A0';

export type CalendarItem = {
	/** Unique per item (occurrence key, or a birthday key) */
	id: string;
	title: string;
	allDay: boolean;
	startAt: number;
	endAt: number;
	startTz: string;
	color: string;
	pinned: boolean;
	/** Copies in other calendars folded into this one (All Calendars view) */
	folded: number;
	event: Occurrence<ClientEvent> | null;
	birthday: { name: string; age: number | null } | null;
};

type Inputs = {
	events: ClientEvent[];
	labels: ClientLabel[];
	members: ClientMember[];
	virtualMembers: ClientVirtualMember[];
	calendars: ClientCalendar[];
	from: number;
	to: number;
	fold: boolean;
};

export function buildItems({
	events,
	labels,
	members,
	virtualMembers,
	calendars,
	from,
	to,
	fold
}: Inputs): CalendarItem[] {
	const colorById = new Map(labels.map((l) => [l.id, l.color]));
	const items: CalendarItem[] = expandEvents(events, from, to).map((o) => ({
		id: o.key,
		title: o.title,
		allDay: o.allDay,
		startAt: o.startAt!,
		endAt: o.endAt ?? o.startAt!,
		startTz: o.startTz,
		color: (o.labelId && colorById.get(o.labelId)) || NO_LABEL_COLOR,
		pinned: isPinned(o, o.occurrenceStartAt),
		folded: 0,
		event: o,
		birthday: null
	}));

	const out = fold ? foldDuplicates(items) : items;
	return [...out, ...birthdays(members, virtualMembers, calendars, from, to)];
}

/** Identical events in different calendars (same title and time) are shown once. */
function foldDuplicates(items: CalendarItem[]): CalendarItem[] {
	const groups = new Map<string, CalendarItem[]>();
	for (const item of items) {
		const key = JSON.stringify([
			item.title.trim().toLowerCase(),
			item.allDay,
			item.startAt,
			item.endAt
		]);
		groups.set(key, [...(groups.get(key) ?? []), item]);
	}
	return [...groups.values()]
		.map((group) => {
			const calendarsInGroup = new Set(group.map((g) => g.event?.calendarId));
			if (calendarsInGroup.size < 2) return group;
			const [first, ...rest] = group;
			return [{ ...first, pinned: group.some((g) => g.pinned), folded: rest.length }];
		})
		.flat();
}

/** Yearly birthday entries for members and virtual members who share them. */
function birthdays(
	members: ClientMember[],
	virtualMembers: ClientVirtualMember[],
	calendars: ClientCalendar[],
	from: number,
	to: number
): CalendarItem[] {
	const showIn = new Set(calendars.filter((c) => c.me.showMemberBirthdays).map((c) => c.id));
	const people = new Map<string, { name: string; birthday: string }>();
	for (const m of members) {
		// The same person appears once per shared calendar; show them once
		if (m.birthday && showIn.has(m.calendarId))
			people.set(`u:${m.userId}`, { name: m.name, birthday: m.birthday });
	}
	for (const v of virtualMembers) {
		if (v.birthday && v.showBirthday && v.preset !== 'car' && showIn.has(v.calendarId))
			people.set(`v:${v.id}`, { name: v.name, birthday: v.birthday });
	}
	const firstYear = new Date(from).getUTCFullYear();
	const lastYear = new Date(to).getUTCFullYear();
	const out: CalendarItem[] = [];
	for (const [key, p] of people) {
		const [by, bm, bd] = p.birthday.split('-').map(Number);
		for (let y = firstYear; y <= lastYear; y++) {
			// Feb 29 birthdays fall on Feb 28 in other years
			const day = bm === 2 && bd === 29 && !isLeap(y) ? 28 : bd;
			const at = Date.UTC(y, bm - 1, day);
			if (at < from - DAY_MS || at > to + DAY_MS) continue;
			out.push({
				id: `bday:${key}:${y}`,
				title: `🎂 ${p.name}`,
				allDay: true,
				startAt: at,
				endAt: at,
				startTz: 'UTC',
				color: BIRTHDAY_COLOR,
				pinned: false,
				folded: 0,
				event: null,
				birthday: { name: p.name, age: y >= by ? y - by : null }
			});
		}
	}
	return out;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * The editor/API payload for an existing event (or occurrence), optionally moved by
 * whole days. Times keep their wall-clock value in the event's own zone.
 */
export function eventToInput(e: ClientEvent, shiftDays = 0) {
	const tz = e.allDay ? 'UTC' : e.startTz;
	const shift = (ms: number) => fromWall(toWall(ms, tz) + shiftDays * DAY_MS, tz);
	const startAt = shift(e.startAt!);
	const endAt = shift(e.endAt ?? e.startAt!);
	return {
		calendarId: e.calendarId,
		title: e.title,
		allDay: e.allDay,
		startDate: e.allDay ? utcMsToDate(startAt) : dayKey(startAt, e.startTz),
		endDate: e.allDay ? utcMsToDate(endAt) : dayKey(endAt, e.endTz),
		startTime: e.allDay ? undefined : timeOf(startAt, e.startTz),
		endTime: e.allDay ? undefined : timeOf(endAt, e.endTz),
		startTz: e.allDay ? 'UTC' : e.startTz,
		endTz: e.allDay ? 'UTC' : e.endTz,
		locationName: e.locationName,
		locationLat: e.locationLat,
		locationLon: e.locationLon,
		url: e.url,
		note: e.note,
		labelId: e.labelId,
		attendees: e.attendees,
		alerts: e.alerts,
		recurrence: e.recurrence,
		checklist: e.checklist.map((c) => ({ id: c.id, text: c.text, done: c.done })),
		fileIds: e.files.map((f) => f.id),
		dayCount: e.dayCount
	};
}

/** Whole days between two 'YYYY-MM-DD' keys. */
export const daysBetween = (a: string, b: string) =>
	Math.round((dateToUtcMs(b) - dateToUtcMs(a)) / DAY_MS);
