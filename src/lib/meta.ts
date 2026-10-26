import type { CalendarPurpose, ClientVirtualMember } from '#lib/types.js';

export const PURPOSES: {
	id: CalendarPurpose;
	label: string;
	emoji: string;
	description: string;
}[] = [
	{
		id: 'family',
		label: 'Family',
		emoji: '🏠',
		description: "See the whole family's schedule at a glance."
	},
	{
		id: 'relationship',
		label: 'Relationship',
		emoji: '💞',
		description: 'Find time for each other by sharing schedules.'
	},
	{
		id: 'friends',
		label: 'Friends',
		emoji: '🎉',
		description: 'Plan time together and chat about it in comments.'
	},
	{
		id: 'work',
		label: 'Work',
		emoji: '💼',
		description: "Meetings, colleagues' schedules and deadlines in one place."
	},
	{
		id: 'shift',
		label: 'Shift schedule',
		emoji: '🕘',
		description: "Share shifts and see who's working."
	},
	{
		id: 'school',
		label: 'School events',
		emoji: '🎒',
		description: 'School events and assignment deadlines.'
	},
	{
		id: 'lesson',
		label: 'Lessons',
		emoji: '🎹',
		description: 'Lesson schedules, and changes as soon as they happen.'
	},
	{
		id: 'group',
		label: 'Group / club',
		emoji: '⚽',
		description: 'Club activities, practices and games.'
	},
	{
		id: 'hobby',
		label: 'Hobbies',
		emoji: '🎬',
		description: 'Premieres, releases and events you care about.'
	},
	{
		id: 'personal',
		label: 'Personal',
		emoji: '🙂',
		description: 'Your own events, viewed alongside shared calendars.'
	},
	{ id: 'other', label: 'Other', emoji: '📅', description: 'Anything else.' }
];

export const purposeOf = (id: CalendarPurpose) =>
	PURPOSES.find((p) => p.id === id) ?? PURPOSES.at(-1)!;

export const VIRTUAL_PRESETS: {
	id: ClientVirtualMember['preset'];
	label: string;
	emoji: string;
}[] = [
	{ id: 'child', label: 'Child', emoji: '🧒' },
	{ id: 'pet', label: 'Pet', emoji: '🐾' },
	{ id: 'car', label: 'Car', emoji: '🚗' },
	{ id: 'grandfather', label: 'Grandfather', emoji: '👴' },
	{ id: 'grandmother', label: 'Grandmother', emoji: '👵' },
	{ id: 'other', label: 'Other', emoji: '👤' }
];

export const MEMBER_ATTRIBUTE_LABELS: Record<string, string> = {
	husband: 'Husband (Dad)',
	wife: 'Wife (Mom)',
	child: 'Child',
	grandfather: 'Grandfather',
	grandmother: 'Grandmother',
	boyfriend: 'Boyfriend',
	girlfriend: 'Girlfriend',
	other: 'Other'
};

/** Alert presets, in minutes before start. Negative values on all-day events mean "on the day at HH:mm". */
export const TIMED_ALERTS = [0, 5, 10, 15, 30, 60, 1440, 2880, 4320, 10080, 20160, 30240, 43200];
export const ALL_DAY_ALERTS = [-540, 1440 - 540, 2880 - 540, 10080 - 540];

export function alertLabel(minutes: number, allDay: boolean): string {
	if (allDay) {
		const daysBefore = Math.ceil(minutes / 1440);
		const minuteOfDay = daysBefore * 1440 - minutes;
		const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
		const mm = String(minuteOfDay % 60).padStart(2, '0');
		const day =
			daysBefore === 0
				? 'On the day'
				: daysBefore === 1
					? '1 day before'
					: daysBefore % 7 === 0
						? `${daysBefore / 7} week${daysBefore > 7 ? 's' : ''} before`
						: `${daysBefore} days before`;
		return `${day} at ${hh}:${mm}`;
	}
	if (minutes === 0) return 'At time of event';
	if (minutes === 43200) return '1 month before';
	const parts: [number, string][] = [
		[10080, 'week'],
		[1440, 'day'],
		[60, 'hour'],
		[1, 'min']
	];
	for (const [unit, name] of parts) {
		if (minutes % unit === 0) {
			const n = minutes / unit;
			return `${n} ${name}${n > 1 && name !== 'min' ? 's' : ''} before`;
		}
	}
	return `${minutes} min before`;
}
