import { describe, expect, it } from 'vitest';
import { buildItems, eventToInput } from './calendar-items';
import { dateToUtcMs, zonedToUtc } from './dates';
import type { ClientCalendar, ClientEvent, ClientMember } from './types';

const cal = (id: string, showMemberBirthdays = true) =>
	({ id, me: { showMemberBirthdays } }) as unknown as ClientCalendar;

function ev(overrides: Partial<ClientEvent> = {}): ClientEvent {
	return {
		id: 'e1',
		calendarId: 'c1',
		kind: 'event',
		title: 'Dinner',
		allDay: false,
		startAt: zonedToUtc('2026-10-10', '19:00', 'America/Chicago'),
		endAt: zonedToUtc('2026-10-10', '21:00', 'America/Chicago'),
		startTz: 'America/Chicago',
		endTz: 'America/Chicago',
		locationName: '',
		locationLat: null,
		locationLon: null,
		url: '',
		note: '',
		labelId: null,
		recurrence: [],
		parentId: null,
		attendees: [],
		alerts: [],
		checklist: [],
		files: [],
		pinnedAt: null,
		pinnedOccurrences: [],
		dayCount: null,
		createdByMemberId: null,
		createdAt: 0,
		updatedAt: 0,
		...overrides
	};
}

const range = { from: dateToUtcMs('2026-09-27'), to: dateToUtcMs('2026-11-08') };
const base = {
	labels: [],
	members: [],
	virtualMembers: [],
	calendars: [cal('c1'), cal('c2')],
	...range
};

describe('buildItems', () => {
	it('folds identical events from different calendars in All Calendars', () => {
		const items = buildItems({
			...base,
			events: [ev(), ev({ id: 'e2', calendarId: 'c2' })],
			fold: true
		});
		expect(items).toHaveLength(1);
		expect(items[0].folded).toBe(1);
		expect(
			buildItems({ ...base, events: [ev(), ev({ id: 'e2', calendarId: 'c2' })], fold: false })
		).toHaveLength(2);
	});

	it('does not fold two identical events in the same calendar', () => {
		expect(buildItems({ ...base, events: [ev(), ev({ id: 'e2' })], fold: true })).toHaveLength(2);
	});

	it('marks pinned occurrences', () => {
		const series = ev({ recurrence: ['RRULE:FREQ=WEEKLY;COUNT=3'] });
		const second = zonedToUtc('2026-10-17', '19:00', 'America/Chicago');
		const items = buildItems({
			...base,
			events: [{ ...series, pinnedOccurrences: [second] }],
			fold: false
		});
		expect(items.map((i) => i.pinned)).toEqual([false, true, false]);
	});

	it('adds yearly birthdays once per person, respecting the calendar setting', () => {
		const member = (calendarId: string) =>
			({
				id: `m-${calendarId}`,
				userId: 'u1',
				calendarId,
				name: 'Sam',
				birthday: '1990-10-20'
			}) as ClientMember;
		const items = buildItems({
			...base,
			events: [],
			members: [member('c1'), member('c2')],
			fold: true
		});
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			title: '🎂 Sam',
			allDay: true,
			birthday: { name: 'Sam', age: 36 }
		});
		const hidden = buildItems({
			...base,
			calendars: [cal('c1', false), cal('c2', false)],
			events: [],
			members: [member('c1')],
			fold: true
		});
		expect(hidden).toHaveLength(0);
	});
});

describe('eventToInput', () => {
	it('moves an event by whole days keeping its wall-clock time across DST', () => {
		const input = eventToInput(
			ev({
				startAt: zonedToUtc('2026-10-30', '19:00', 'America/Chicago'),
				endAt: zonedToUtc('2026-10-30', '21:00', 'America/Chicago')
			}),
			3
		);
		expect(input).toMatchObject({ startDate: '2026-11-02', startTime: '19:00', endTime: '21:00' });
	});

	it('moves all-day events by date', () => {
		const input = eventToInput(
			ev({
				allDay: true,
				startAt: dateToUtcMs('2026-10-10'),
				endAt: dateToUtcMs('2026-10-12'),
				startTz: 'UTC',
				endTz: 'UTC'
			}),
			-2
		);
		expect(input).toMatchObject({ allDay: true, startDate: '2026-10-08', endDate: '2026-10-10' });
	});
});
