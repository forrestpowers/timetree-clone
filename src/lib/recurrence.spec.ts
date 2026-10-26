import { describe, expect, it } from 'vitest';
import { dateToUtcMs, timeOf, dayKey, zonedToUtc } from './dates';
import {
	continueFrom,
	describeRepeat,
	expandEvents,
	ruleToSpec,
	specToRule,
	truncateBefore,
	withExdate
} from './recurrence';

const CHI = 'America/Chicago';

const timed = (recurrence: string[], date = '2026-10-05', from = '09:00', to = '10:00') => ({
	id: 'e1',
	allDay: false,
	startAt: zonedToUtc(date, from, CHI),
	endAt: zonedToUtc(date, to, CHI),
	startTz: CHI,
	recurrence
});
const allDay = (recurrence: string[], start = '2026-10-05', end = start) => ({
	id: 'a1',
	allDay: true,
	startAt: dateToUtcMs(start),
	endAt: dateToUtcMs(end),
	startTz: 'UTC',
	recurrence
});
const range = (a: string, b: string) =>
	[zonedToUtc(a, '00:00', CHI), zonedToUtc(b, '23:59', CHI)] as const;

describe('expandEvents', () => {
	it('passes non-repeating events through when they overlap', () => {
		const [from, to] = range('2026-10-01', '2026-10-31');
		expect(expandEvents([timed([])], from, to)).toHaveLength(1);
		expect(expandEvents([timed([], '2026-12-01')], from, to)).toHaveLength(0);
	});

	it('keeps the wall-clock time across a daylight-saving change', () => {
		const e = timed(['RRULE:FREQ=WEEKLY']);
		const [from, to] = range('2026-10-01', '2026-11-30'); // DST ends Nov 1
		const occ = expandEvents([e], from, to);
		expect(occ.length).toBe(9);
		expect(new Set(occ.map((o) => timeOf(o.startAt!, CHI)))).toEqual(new Set(['09:00']));
		expect(new Set(occ.map((o) => timeOf(o.endAt!, CHI)))).toEqual(new Set(['10:00']));
	});

	it('honours BYDAY, INTERVAL and COUNT', () => {
		const e = timed(['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=5']);
		const [from, to] = range('2026-10-01', '2027-01-31');
		const days = expandEvents([e], from, to).map((o) => dayKey(o.startAt!, CHI));
		expect(days).toEqual(['2026-10-05', '2026-10-07', '2026-10-19', '2026-10-21', '2026-11-02']);
	});

	it('treats a date-only UNTIL as inclusive of that day', () => {
		const e = timed(['RRULE:FREQ=DAILY;UNTIL=20261008']);
		const [from, to] = range('2026-10-01', '2026-10-31');
		expect(expandEvents([e], from, to)).toHaveLength(4);
	});

	it('skips EXDATEs in UTC, TZID and date forms', () => {
		const e = timed([
			'RRULE:FREQ=DAILY;COUNT=6',
			`EXDATE:${new Date(zonedToUtc('2026-10-06', '09:00', CHI)).toISOString().replace(/[-:]|\.\d{3}/g, '')}`,
			'EXDATE;TZID=America/Chicago:20261007T090000',
			'EXDATE;VALUE=DATE:20261008'
		]);
		const [from, to] = range('2026-10-01', '2026-10-31');
		const days = expandEvents([e], from, to).map((o) => dayKey(o.startAt!, CHI));
		expect(days).toEqual(['2026-10-05', '2026-10-09', '2026-10-10']);
	});

	it('expands all-day and multi-day all-day events', () => {
		const e = allDay(['RRULE:FREQ=MONTHLY;COUNT=3'], '2026-10-31', '2026-11-01');
		const occ = expandEvents([e], dateToUtcMs('2026-10-01'), dateToUtcMs('2027-03-01'));
		// The 31st is skipped in months without one (RFC 5545 behaviour)
		expect(occ.map((o) => new Date(o.startAt!).toISOString().slice(0, 10))).toEqual([
			'2026-10-31',
			'2026-12-31',
			'2027-01-31'
		]);
		expect(occ[0].endAt! - occ[0].startAt!).toBe(86_400_000);
	});

	it('gives each occurrence a stable key and occurrenceStartAt', () => {
		const e = timed(['RRULE:FREQ=DAILY;COUNT=2']);
		const [from, to] = range('2026-10-01', '2026-10-31');
		const [a, b] = expandEvents([e], from, to);
		expect(a.key).toBe(`e1@${a.startAt}`);
		expect(b.occurrenceStartAt).toBe(b.startAt);
	});
});

describe('editing a series', () => {
	it('withExdate removes exactly one occurrence', () => {
		const e = timed(['RRULE:FREQ=DAILY;COUNT=3']);
		const [from, to] = range('2026-10-01', '2026-10-31');
		const second = expandEvents([e], from, to)[1].startAt!;
		const left = expandEvents([{ ...e, recurrence: withExdate(e, second) }], from, to);
		expect(left.map((o) => o.startAt)).not.toContain(second);
		expect(left).toHaveLength(2);
	});

	it('truncateBefore + continueFrom split a counted series without losing occurrences', () => {
		const e = timed(['RRULE:FREQ=DAILY;COUNT=6']);
		const [from, to] = range('2026-10-01', '2026-10-31');
		const all = expandEvents([e], from, to);
		const split = all[2].startAt!;
		const head = expandEvents([{ ...e, recurrence: truncateBefore(e, split) }], from, to);
		const tailRule = continueFrom(e, split);
		const tail = expandEvents(
			[{ ...e, startAt: split, endAt: split + 3_600_000, recurrence: tailRule }],
			from,
			to
		);
		expect(head.map((o) => o.startAt)).toEqual(all.slice(0, 2).map((o) => o.startAt));
		expect(tail.map((o) => o.startAt)).toEqual(all.slice(2).map((o) => o.startAt));
	});

	it('truncates all-day series to the previous day', () => {
		const e = allDay(['RRULE:FREQ=WEEKLY']);
		expect(truncateBefore(e, dateToUtcMs('2026-10-19'))).toEqual([
			'RRULE:FREQ=WEEKLY;UNTIL=20261018'
		]);
	});
});

describe('repeat picker', () => {
	it('round-trips specs through RRULE', () => {
		const spec = {
			freq: 'weekly' as const,
			interval: 2,
			weekdays: [1, 3],
			monthlyBy: 'date' as const,
			end: { type: 'until' as const, date: '2026-12-31' }
		};
		const rule = specToRule(spec, '2026-10-05');
		expect(rule).toBe('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231');
		expect(ruleToSpec([rule])).toEqual(spec);
	});

	it('builds "nth weekday" monthly rules, using -1 for the last week', () => {
		const base = {
			freq: 'monthly' as const,
			interval: 1,
			weekdays: [],
			monthlyBy: 'weekday' as const,
			end: { type: 'never' as const }
		};
		expect(specToRule(base, '2026-10-13')).toBe('RRULE:FREQ=MONTHLY;BYDAY=2TU');
		expect(specToRule(base, '2026-10-27')).toBe('RRULE:FREQ=MONTHLY;BYDAY=-1TU');
	});

	it('describes rules in plain English', () => {
		expect(describeRepeat(['RRULE:FREQ=WEEKLY;BYDAY=MO,WE'], '2026-10-05')).toBe(
			'Every week on Mon, Wed'
		);
		expect(describeRepeat(['RRULE:FREQ=MONTHLY;COUNT=10'], '2026-10-15')).toBe(
			'Every month on the 15th · 10 times'
		);
		expect(describeRepeat(['RRULE:FREQ=YEARLY'], '2026-10-25')).toBe('Every year on Oct 25');
		expect(describeRepeat(['RRULE:FREQ=DAILY;BYHOUR=9'], '2026-10-25')).toBe(
			'Repeats (custom rule)'
		);
		expect(describeRepeat([], '2026-10-25')).toBe('Not repeating');
	});
});
