import { describe, expect, it } from 'vitest';
import { planTimeTreeImport } from './timetree-plan';

const ME = 13226745;

function event(overrides: Record<string, unknown> = {}) {
	return {
		uuid: crypto.randomUUID().replace(/-/g, ''),
		category: 1,
		type: 0,
		author_id: ME,
		title: 'Work',
		all_day: true,
		start_at: 1797033600000, // 2026-12-12 00:00 UTC
		start_timezone: 'UTC',
		end_at: 1797033600000,
		end_timezone: 'UTC',
		label_id: 9,
		location: '',
		location_lat: null,
		location_lon: null,
		url: null,
		note: null,
		attendees: [ME],
		recurrences: [],
		recurring_uuid: null,
		parent_id: null,
		alerts: [],
		deactivated_at: null,
		created_at: 1792595874801,
		updated_at: 1792964998596,
		...overrides
	};
}

function file(events: unknown[]) {
	return {
		calendar: {
			id: 26406140,
			name: 'Calendar',
			author_id: ME,
			deactivated_at: null,
			calendar_labels: [
				{ id: 9, name: '', color: 16629805, order: 9 },
				{ id: 1, name: 'Mom', color: 3067015, order: 1 }
			],
			calendar_users: [{ user_id: ME, name: '' }]
		},
		labels: { '1': { name: '', color: '#2ecc87' }, '9': { name: '', color: '#fdc02d' } },
		events
	};
}

describe('planTimeTreeImport', () => {
	it('maps an all-day event with label, attendee and timestamps', () => {
		const plan = planTimeTreeImport(file([event()]));
		expect(plan.events).toHaveLength(1);
		expect(plan.events[0]).toMatchObject({
			kind: 'event',
			allDay: true,
			startAt: 1797033600000,
			endAt: 1797033600000,
			startTz: 'UTC',
			labelExternalId: 9,
			attendeeExternalIds: [String(ME)],
			createdAt: 1792595874801
		});
		expect(plan.users).toEqual([{ externalId: String(ME), name: '', eventCount: 1 }]);
	});

	it('orders labels and converts integer colors to hex', () => {
		const plan = planTimeTreeImport(file([]));
		expect(plan.labels).toEqual([
			{ externalId: 1, name: 'Mom', color: '#2ECC87' },
			{ externalId: 9, name: '', color: '#FDC02D' }
		]);
	});

	it('keeps timed events in their own zone and parses string coordinates', () => {
		const plan = planTimeTreeImport(
			file([
				event({
					all_day: false,
					start_timezone: 'America/Chicago',
					end_timezone: 'America/Chicago',
					start_at: 1797093000000,
					end_at: 1797096600000,
					location: '429 Houston St',
					location_lat: '36.142606',
					location_lon: '-86.767021',
					alerts: [30, 15, 15]
				})
			])
		);
		expect(plan.events[0]).toMatchObject({
			allDay: false,
			startTz: 'America/Chicago',
			locationLat: 36.142606,
			locationLon: -86.767021,
			alerts: [15, 30]
		});
	});

	it('skips deleted events and birthdays, and keeps memos as memos', () => {
		const plan = planTimeTreeImport(
			file([
				event({ deactivated_at: 1 }),
				event({ type: 1 }),
				event({ category: 2, title: 'Groceries' }),
				event()
			])
		);
		expect(plan.skipped).toMatchObject({ deleted: 1, birthdays: 1 });
		expect(plan.stats).toMatchObject({ events: 1, memos: 1 });
	});

	it('repairs bad data instead of failing', () => {
		const plan = planTimeTreeImport(
			file([
				event({
					start_timezone: 'Mars/Olympus',
					all_day: false,
					end_at: 1797000000000,
					title: 'x'.repeat(150)
				}),
				event({ label_id: 42, url: 'javascript:alert(1)' }),
				{ not: 'an event' }
			])
		);
		const [a, b] = plan.events;
		expect(a.startTz).toBe('UTC');
		expect(a.endAt).toBe(a.startAt); // end before start is clamped
		expect(a.title).toHaveLength(100);
		expect(b.labelExternalId).toBeNull();
		expect(b.url).toBe('');
		expect(plan.skipped.invalid).toBe(1);
		expect(plan.warnings.length).toBeGreaterThanOrEqual(3);
	});

	it('rejects files that are not TimeTree exports', () => {
		expect(() => planTimeTreeImport({ hello: 'world' })).toThrow(/TimeTree/);
	});
});
