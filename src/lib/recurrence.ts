/**
 * Repeating events, stored as iCalendar lines (RRULE / EXDATE) on the series event.
 *
 * Rules are expanded in "wall-clock" time: an event at 09:00 America/Chicago stays at
 * 09:00 across daylight-saving changes. All-day events use UTC midnights, which are
 * already wall dates.
 */
import * as rrulePkg from 'rrule';
import { DAY_MS, dayKey, utcMsToDate, zonedToUtc } from '#lib/dates.js';

// rrule ships CommonJS for Node and ESM for bundlers; accept either shape
type RRuleModule = typeof import('rrule');
const rr = (
	(rrulePkg as unknown as RRuleModule).RRule
		? rrulePkg
		: (rrulePkg as unknown as { default: RRuleModule }).default
) as RRuleModule;
const { RRule } = rr;

export type Recurring = {
	allDay: boolean;
	startAt: number | null;
	endAt: number | null;
	startTz: string;
	recurrence: string[];
};

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** Instant -> a Date whose UTC fields equal the wall-clock time in `tz`. */
export function toWall(ms: number, tz: string): number {
	if (tz === 'UTC') return ms;
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: tz,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(ms);
	const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
	return Date.UTC(
		get('year'),
		get('month') - 1,
		get('day'),
		get('hour'),
		get('minute'),
		get('second')
	);
}

/** Wall-clock (as fake-UTC ms) in `tz` -> instant. */
export function fromWall(wall: number, tz: string): number {
	if (tz === 'UTC') return wall;
	const d = new Date(wall);
	const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
	const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
	return zonedToUtc(date, time, tz) + d.getUTCSeconds() * 1000;
}

const zoneOf = (e: Recurring) => (e.allDay ? 'UTC' : e.startTz);

export const isRecurring = (e: { recurrence: string[] }) =>
	e.recurrence.some((l) => /^RRULE[:;]/i.test(l));

function ruleLine(lines: string[]) {
	return lines.find((l) => /^RRULE[:;]/i.test(l));
}

/** "20261231", "20261231T150000", "20261231T150000Z" -> wall ms in the event's zone */
function parseIcalTime(
	value: string,
	valueTz: string | null,
	eventTz: string
): { wall: number; dateOnly: boolean } | null {
	const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
	if (!m) return null;
	const [, y, mo, d, hh, mi, ss, z] = m;
	const wallInSource = Date.UTC(+y, +mo - 1, +d, +(hh ?? 0), +(mi ?? 0), +(ss ?? 0));
	if (!hh) return { wall: wallInSource, dateOnly: true };
	if (z) return { wall: toWall(wallInSource, eventTz), dateOnly: false };
	if (valueTz && valueTz !== eventTz)
		return { wall: toWall(fromWall(wallInSource, valueTz), eventTz), dateOnly: false };
	return { wall: wallInSource, dateOnly: false };
}

function parseExdates(lines: string[], tz: string) {
	const walls = new Set<number>();
	const days = new Set<string>();
	for (const line of lines) {
		const m = line.match(/^EXDATE((?:;[^:]*)?):(.*)$/i);
		if (!m) continue;
		const valueTz = m[1].match(/TZID=([^;:]+)/i)?.[1] ?? null;
		for (const v of m[2].split(',')) {
			const t = parseIcalTime(v, valueTz, tz);
			if (!t) continue;
			if (t.dateOnly) days.add(utcMsToDate(t.wall));
			else walls.add(t.wall);
		}
	}
	return { walls, days };
}

/** An RRule set up in wall-clock space for this event, or null if it doesn't repeat. */
function buildRule(e: Recurring) {
	const line = ruleLine(e.recurrence);
	if (!line || e.startAt == null) return null;
	const tz = zoneOf(e);
	const body = line.replace(/^RRULE[:;]/i, '');
	let options;
	try {
		options = RRule.parseString(body.replace(/;?UNTIL=[^;]*/i, '').replace(/;?DTSTART=[^;]*/i, ''));
	} catch {
		return null;
	}
	options.dtstart = new Date(toWall(e.startAt, tz));
	options.tzid = undefined;
	const untilRaw = body.match(/UNTIL=([^;]+)/i)?.[1];
	if (untilRaw) {
		const t = parseIcalTime(untilRaw, null, tz);
		// A date-only UNTIL includes that whole day
		if (t) options.until = new Date(t.dateOnly ? t.wall + DAY_MS - 1000 : t.wall);
	}
	try {
		return new RRule(options);
	} catch {
		return null;
	}
}

export type Occurrence<T> = T & {
	/** Start instant of this occurrence (same as startAt); null for non-repeating events */
	occurrenceStartAt: number | null;
	/** Unique per occurrence: `${id}` or `${id}@${occurrenceStartAt}` */
	key: string;
};

const MAX_OCCURRENCES = 2000;

/**
 * Expand events into the occurrences overlapping [from, to] (instants).
 * Non-repeating events pass through if they overlap.
 */
export function expandEvents<T extends Recurring & { id: string }>(
	events: T[],
	from: number,
	to: number
): Occurrence<T>[] {
	const out: Occurrence<T>[] = [];
	for (const e of events) {
		if (e.startAt == null) continue;
		const end = e.endAt ?? e.startAt;
		const rule = isRecurring(e) ? buildRule(e) : null;
		if (!rule) {
			if (e.startAt <= to && end >= from) out.push({ ...e, occurrenceStartAt: null, key: e.id });
			continue;
		}
		const tz = zoneOf(e);
		const wallStart0 = toWall(e.startAt, tz);
		const wallDuration = toWall(end, zoneOf(e)) - wallStart0;
		const { walls, days } = parseExdates(e.recurrence, tz);
		const windowStart = new Date(toWall(from, tz) - wallDuration - DAY_MS);
		const windowEnd = new Date(toWall(to, tz) + DAY_MS);
		let n = 0;
		for (const occ of rule.between(windowStart, windowEnd, true)) {
			if (++n > MAX_OCCURRENCES) break;
			const wall = occ.getTime();
			if (walls.has(wall) || days.has(utcMsToDate(wall))) continue;
			const startAt = fromWall(wall, tz);
			const endAt = fromWall(wall + wallDuration, tz);
			if (startAt > to || endAt < from) continue;
			out.push({ ...e, startAt, endAt, occurrenceStartAt: startAt, key: `${e.id}@${startAt}` });
		}
	}
	return out;
}

/** The occurrence of `e` starting at `occStart`, or null if there is none. */
export function findOccurrence<T extends Recurring & { id: string }>(
	e: T,
	occStart: number
): Occurrence<T> | null {
	return (
		expandEvents([e], occStart, occStart).find((o) => o.occurrenceStartAt === occStart) ?? null
	);
}

// ---------------------------------------------------------------------------
// Editing a series
// ---------------------------------------------------------------------------

function icalStamp(ms: number, allDay: boolean): string {
	const d = new Date(ms);
	const date = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
	return allDay
		? date
		: `${date}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Exclude one occurrence (by its start instant). */
export function withExdate(e: Recurring, occStart: number): string[] {
	const line = e.allDay
		? `EXDATE;VALUE=DATE:${icalStamp(occStart, true)}`
		: `EXDATE:${icalStamp(occStart, false)}`;
	return [...e.recurrence, line];
}

/** How many occurrences start before `occStart` (bounded). */
export function countBefore(e: Recurring & { id: string }, occStart: number): number {
	if (e.startAt == null) return 0;
	const rule = buildRule(e);
	if (!rule) return 0;
	const tz = zoneOf(e);
	return rule.between(new Date(toWall(e.startAt, tz)), new Date(toWall(occStart, tz) - 1000), true)
		.length;
}

/** End the series just before `occStart` ("this and future" edits and deletes). */
export function truncateBefore(e: Recurring, occStart: number): string[] {
	const tz = zoneOf(e);
	const until = e.allDay
		? `UNTIL=${icalStamp(occStart - DAY_MS, true)}`
		: `UNTIL=${icalStamp(fromWall(toWall(occStart, tz) - 1000, tz), false)}`;
	return e.recurrence.map((l) => {
		if (!/^RRULE[:;]/i.test(l)) return l;
		const body = l
			.replace(/^RRULE[:;]/i, '')
			.split(';')
			.filter((p) => p && !/^(UNTIL|COUNT)=/i.test(p));
		return `RRULE:${[...body, until].join(';')}`;
	});
}

/** The rule for the second half of a split series: same pattern, remaining COUNT. */
export function continueFrom(e: Recurring & { id: string }, occStart: number): string[] {
	const count = Number(ruleLine(e.recurrence)?.match(/COUNT=(\d+)/i)?.[1] ?? 0);
	const remaining = count ? Math.max(1, count - countBefore(e, occStart)) : 0;
	return e.recurrence.map((l) =>
		/^RRULE[:;]/i.test(l) && count ? l.replace(/COUNT=\d+/i, `COUNT=${remaining}`) : l
	);
}

// ---------------------------------------------------------------------------
// The repeat picker: simple specs <-> RRULE
// ---------------------------------------------------------------------------

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RepeatSpec = {
	freq: Frequency;
	interval: number;
	/** 0 = Sunday … 6 = Saturday (weekly only) */
	weekdays: number[];
	/** Monthly: same date each month, or the same "2nd Tuesday" */
	monthlyBy: 'date' | 'weekday';
	end: { type: 'never' } | { type: 'until'; date: string } | { type: 'count'; count: number };
};

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ordinal = (n: number) =>
	n === -1
		? 'last'
		: `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** Week-of-month for a date: 1-4, or -1 for the last such weekday of the month. */
export function nthWeekday(date: string): number {
	const [y, m, d] = date.split('-').map(Number);
	const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
	if (d + 7 > daysInMonth) return -1;
	return Math.ceil(d / 7);
}

export function specToRule(spec: RepeatSpec, startDate: string): string {
	const parts = [`FREQ=${spec.freq.toUpperCase()}`];
	if (spec.interval > 1) parts.push(`INTERVAL=${spec.interval}`);
	const wd = new Date(`${startDate}T00:00:00Z`).getUTCDay();
	if (spec.freq === 'weekly' && spec.weekdays.length) {
		parts.push(
			`BYDAY=${[...spec.weekdays]
				.sort()
				.map((d) => DAYS[d])
				.join(',')}`
		);
	}
	if (spec.freq === 'monthly' && spec.monthlyBy === 'weekday')
		parts.push(`BYDAY=${nthWeekday(startDate)}${DAYS[wd]}`);
	if (spec.end.type === 'until') parts.push(`UNTIL=${spec.end.date.replace(/-/g, '')}`);
	if (spec.end.type === 'count') parts.push(`COUNT=${Math.max(1, Math.min(999, spec.end.count))}`);
	return `RRULE:${parts.join(';')}`;
}

/** Read a rule back into a spec, or null if it uses features the picker doesn't offer. */
export function ruleToSpec(lines: string[]): RepeatSpec | null {
	const line = ruleLine(lines);
	if (!line) return null;
	const kv = Object.fromEntries(
		line
			.replace(/^RRULE[:;]/i, '')
			.split(';')
			.filter(Boolean)
			.map((p) => p.split('=') as [string, string])
			.map(([k, v]) => [k.toUpperCase(), v])
	);
	const freq = String(kv.FREQ ?? '').toLowerCase() as Frequency;
	if (!['daily', 'weekly', 'monthly', 'yearly'].includes(freq)) return null;
	const known = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'UNTIL', 'COUNT', 'WKST']);
	if (Object.keys(kv).some((k) => !known.has(k))) return null;
	const byday = kv.BYDAY ? String(kv.BYDAY).split(',') : [];
	let monthlyBy: RepeatSpec['monthlyBy'] = 'date';
	let weekdays: number[] = [];
	if (byday.length) {
		if (freq === 'weekly' && byday.every((d) => DAYS.includes(d)))
			weekdays = byday.map((d) => DAYS.indexOf(d));
		else if (freq === 'monthly' && byday.length === 1 && /^-?\d[A-Z]{2}$/.test(byday[0]))
			monthlyBy = 'weekday';
		else return null;
	}
	const until = kv.UNTIL ? String(kv.UNTIL).slice(0, 8) : null;
	return {
		freq,
		interval: Math.max(1, Number(kv.INTERVAL ?? 1)),
		weekdays,
		monthlyBy,
		end: until
			? { type: 'until', date: `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}` }
			: kv.COUNT
				? { type: 'count', count: Number(kv.COUNT) }
				: { type: 'never' }
	};
}

/** "Every 2 weeks on Mon, Wed · until Dec 31, 2026" */
export function describeRepeat(lines: string[], startDate: string): string {
	if (!isRecurring({ recurrence: lines })) return 'Not repeating';
	const spec = ruleToSpec(lines);
	if (!spec) return 'Repeats (custom rule)';
	const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[spec.freq];
	let text = spec.interval > 1 ? `Every ${spec.interval} ${unit}s` : `Every ${unit}`;
	const [y, m, d] = startDate.split('-').map(Number);
	const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
	if (spec.freq === 'weekly') {
		const daysList = spec.weekdays.length ? spec.weekdays : [wd];
		text += ` on ${[...daysList]
			.sort()
			.map((x) => DAY_NAMES[x])
			.join(', ')}`;
	}
	if (spec.freq === 'monthly') {
		text +=
			spec.monthlyBy === 'weekday'
				? ` on the ${ordinal(nthWeekday(startDate))} ${DAY_NAMES[wd]}`
				: ` on the ${ordinal(d)}`;
	}
	if (spec.freq === 'yearly') text += ` on ${MONTHS[m - 1]} ${d}`;
	if (spec.end.type === 'until') {
		const [uy, um, ud] = spec.end.date.split('-').map(Number);
		text += ` · until ${MONTHS[um - 1]} ${ud}, ${uy}`;
	}
	if (spec.end.type === 'count') text += ` · ${spec.end.count} times`;
	return text;
}

/** Presets offered first in the picker, for an event starting on `startDate`. */
export function repeatPresets(startDate: string): { label: string; spec: RepeatSpec }[] {
	const base = {
		interval: 1,
		weekdays: [] as number[],
		monthlyBy: 'date' as const,
		end: { type: 'never' as const }
	};
	return [
		{ label: 'Every day', spec: { ...base, freq: 'daily' } },
		{
			label: describeRepeat([specToRule({ ...base, freq: 'weekly' }, startDate)], startDate),
			spec: { ...base, freq: 'weekly' }
		},
		{
			label: describeRepeat([specToRule({ ...base, freq: 'monthly' }, startDate)], startDate),
			spec: { ...base, freq: 'monthly' }
		},
		{
			label: describeRepeat(
				[specToRule({ ...base, freq: 'monthly', monthlyBy: 'weekday' }, startDate)],
				startDate
			),
			spec: { ...base, freq: 'monthly', monthlyBy: 'weekday' }
		},
		{
			label: describeRepeat([specToRule({ ...base, freq: 'yearly' }, startDate)], startDate),
			spec: { ...base, freq: 'yearly' }
		}
	];
}

/** Day key of an occurrence for display purposes. */
export const occurrenceDay = (
	e: { allDay: boolean; startAt: number | null; startTz: string },
	tz: string
) => (e.startAt == null ? '' : e.allDay ? utcMsToDate(e.startAt) : dayKey(e.startAt, tz));
