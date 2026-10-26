import { describe, expect, it } from 'vitest';
import { dateToUtcMs, eventDayRange, monthGrid, zonedToUtc } from './dates';
import { layoutMonth } from './month-layout';

const allDay = (id: string, start: string, end = start) => ({
	id,
	title: id,
	allDay: true,
	startAt: dateToUtcMs(start),
	endAt: dateToUtcMs(end)
});
const timed = (id: string, date: string, from: string, to: string, tz = 'America/New_York') => ({
	id,
	title: id,
	allDay: false,
	startAt: zonedToUtc(date, from, tz),
	endAt: zonedToUtc(date, to, tz)
});

describe('monthGrid', () => {
	it('starts on the configured weekday and covers 6 weeks', () => {
		const grid = monthGrid('2026-10', 0);
		expect(grid).toHaveLength(42);
		expect(grid[0]).toBe('2026-09-27'); // Sunday
		expect(grid).toContain('2026-10-31');
		expect(monthGrid('2026-10', 1)[0]).toBe('2026-09-28'); // Monday
	});
});

describe('eventDayRange', () => {
	it('uses UTC dates for all-day events regardless of viewer time zone', () => {
		expect(eventDayRange(allDay('a', '2026-10-05', '2026-10-07'), 'Asia/Tokyo')).toEqual([
			'2026-10-05',
			'2026-10-07'
		]);
	});
	it('does not spill a timed event ending at midnight into the next day', () => {
		const e = timed('t', '2026-10-05', '22:00', '23:59');
		e.endAt = zonedToUtc('2026-10-06', '00:00', 'America/New_York');
		expect(eventDayRange(e, 'America/New_York')).toEqual(['2026-10-05', '2026-10-05']);
	});
	it('shifts timed events into the viewer time zone', () => {
		const e = timed('t', '2026-10-05', '20:00', '21:00', 'America/New_York');
		expect(eventDayRange(e, 'Asia/Tokyo')).toEqual(['2026-10-06', '2026-10-06']);
	});
});

describe('layoutMonth', () => {
	const days = monthGrid('2026-10', 0);

	it('splits a multi-day event across weeks', () => {
		const weeks = layoutMonth(days, [allDay('trip', '2026-10-09', '2026-10-13')], 'UTC', 4);
		const w2 = weeks[1].bars[0];
		const w3 = weeks[2].bars[0];
		expect(w2).toMatchObject({ col: 5, span: 2, continuesAfter: true });
		expect(w3).toMatchObject({ col: 0, span: 3, continuesBefore: true });
	});

	it('packs non-overlapping events into the same lane', () => {
		const weeks = layoutMonth(
			days,
			[allDay('a', '2026-10-05'), allDay('b', '2026-10-06')],
			'UTC',
			4
		);
		expect(weeks[1].bars.map((b) => b.lane)).toEqual([0, 0]);
	});

	it('hides overflow and counts it per day', () => {
		const items = ['a', 'b', 'c', 'd', 'e'].map((id) =>
			timed(id, '2026-10-07', '09:00', '10:00', 'UTC')
		);
		const week = layoutMonth(days, items, 'UTC', 3)[1];
		expect(week.bars).toHaveLength(2);
		expect(week.hidden[3]).toBe(3);
		expect(week.perDay[3]).toHaveLength(5);
	});
});
