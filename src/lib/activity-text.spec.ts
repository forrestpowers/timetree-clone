import { describe, expect, it } from 'vitest';
import { describeActivity } from './activity-text';
import { zonedToUtc } from './dates';
import type { ClientActivity } from './types';

const base: ClientActivity = {
	id: 'a1',
	calendarId: 'c1',
	eventId: 'e1',
	actorMemberId: 'm1',
	type: 'event_created',
	data: {},
	createdAt: 0,
	updatedAt: 0,
	event: { title: 'Dentist', kind: 'event', deleted: false }
};
const say = (over: Partial<ClientActivity>) =>
	describeActivity({ ...base, ...over }, 'America/Chicago', (id) => (id === 'm2' ? 'Jamie' : '?'));

describe('describeActivity', () => {
	it('describes creation, memos and copies', () => {
		expect(say({}).action).toBe('created an event');
		expect(say({ type: 'memo_created' }).action).toBe('created a memo');
		expect(say({ data: { copiedFrom: 'x' } }).action).toBe('copied an event');
	});

	it('names a single changed field, or the whole event for several', () => {
		expect(say({ type: 'event_updated', data: { fields: ['location'] } }).action).toBe(
			'updated the location'
		);
		expect(say({ type: 'event_updated', data: { fields: ['title', 'note'] } }).action).toBe(
			'updated the event'
		);
		expect(say({ type: 'event_updated', data: { item: 'Milk', done: true } }).action).toBe(
			'ticked "Milk"'
		);
		expect(say({ type: 'memo_updated', data: { converted: 'memo' } }).action).toBe(
			'changed an event into a memo'
		);
	});

	it('shows previous and new dates for date changes', () => {
		const line = say({
			type: 'event_updated',
			data: {
				fields: ['date'],
				before: {
					allDay: false,
					startAt: zonedToUtc('2026-10-05', '09:00', 'America/Chicago'),
					endAt: zonedToUtc('2026-10-05', '10:00', 'America/Chicago'),
					tz: 'America/Chicago'
				},
				after: {
					allDay: true,
					startAt: Date.UTC(2026, 9, 6),
					endAt: Date.UTC(2026, 9, 6),
					tz: 'UTC'
				}
			}
		});
		expect(line.dates).toEqual({
			before: 'Mon, Oct 5, 2026 · 09:00 – 10:00',
			after: 'Tue, Oct 6, 2026'
		});
	});

	it('covers comments, likes, members and imports', () => {
		expect(say({ type: 'comment', data: { body: 'On my way' } })).toEqual({
			action: 'commented',
			detail: 'On my way'
		});
		expect(say({ type: 'like' }).action).toBe('liked an event');
		expect(say({ type: 'member_removed', data: { memberId: 'm2' } }).action).toBe('removed Jamie');
		expect(
			say({ type: 'calendar_updated', data: { imported: 2561, source: 'TimeTree' } }).action
		).toBe('imported 2,561 events from TimeTree');
	});
});
