import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

export const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidTimeZone(tz: string | undefined | null): tz is string {
	if (!tz) return false;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}

/** 'YYYY-MM-DD' of an instant in a time zone. */
export function dayKey(ms: number, tz: string): string {
	return format(new TZDate(ms, tz), 'yyyy-MM-dd');
}

/** UTC midnight of a 'YYYY-MM-DD' date (the all-day storage convention). */
export function dateToUtcMs(date: string): number {
	const [y, m, d] = date.split('-').map(Number);
	return Date.UTC(y, m - 1, d);
}

export function utcMsToDate(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

/** Instant for a wall-clock 'YYYY-MM-DD' + 'HH:mm' in a time zone. */
export function zonedToUtc(date: string, time: string, tz: string): number {
	const [y, m, d] = date.split('-').map(Number);
	const [hh, mm] = time.split(':').map(Number);
	return new TZDate(y, m - 1, d, hh, mm, 0, 0, tz).getTime();
}

export function timeOf(ms: number, tz: string): string {
	return format(new TZDate(ms, tz), 'HH:mm');
}

export function addDaysToKey(key: string, n: number): string {
	return utcMsToDate(dateToUtcMs(key) + n * DAY_MS);
}

export function todayKey(tz: string): string {
	return dayKey(Date.now(), tz);
}

/** Day of week (0 = Sunday) of a 'YYYY-MM-DD'. */
export function weekday(key: string): number {
	return new Date(dateToUtcMs(key)).getUTCDay();
}

/** The 6-week grid (as day keys) shown for a 'YYYY-MM' month. */
export function monthGrid(month: string, weekStart: number): string[] {
	const first = `${month}-01`;
	const offset = (weekday(first) - weekStart + 7) % 7;
	const start = addDaysToKey(first, -offset);
	return Array.from({ length: 42 }, (_, i) => addDaysToKey(start, i));
}

export function shiftMonth(month: string, delta: number): string {
	const [y, m] = month.split('-').map(Number);
	const d = new Date(Date.UTC(y, m - 1 + delta, 1));
	return d.toISOString().slice(0, 7);
}

/** Inclusive range of day keys an event covers when shown in `tz`. */
export function eventDayRange(
	e: { allDay: boolean; startAt: number | null; endAt: number | null },
	tz: string
): [string, string] | null {
	if (e.startAt == null) return null;
	const end = e.endAt ?? e.startAt;
	if (e.allDay) return [utcMsToDate(e.startAt), utcMsToDate(Math.max(end, e.startAt))];
	const first = dayKey(e.startAt, tz);
	// An event ending exactly at midnight doesn't occupy the next day
	const last = end > e.startAt ? dayKey(end - 1, tz) : first;
	return [first, last < first ? first : last];
}

/** Formats a 'YYYY-MM-DD' with a date-fns pattern, independent of any time zone. */
export function formatDayKey(key: string, pattern: string): string {
	const [y, m, d] = key.split('-').map(Number);
	return format(new Date(y, m - 1, d), pattern);
}

export function formatMonth(month: string, pattern = 'MMMM yyyy'): string {
	return formatDayKey(`${month}-01`, pattern);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const weekdayNames = (weekStart: number) =>
	Array.from({ length: 7 }, (_, i) => WEEKDAYS[(weekStart + i) % 7]);

export function deviceTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
