import { formatEventWhen } from '#lib/event-format.js';
import type { ClientActivity } from '#lib/types.js';

const FIELD_NAMES: Record<string, string> = {
	title: 'the title',
	date: 'the date',
	repeat: 'the repeat',
	location: 'the location',
	url: 'the URL',
	note: 'the note',
	label: 'the label',
	attendees: 'the members',
	alerts: 'the reminder settings',
	checklist: 'the to-do list',
	files: 'the attachments',
	day_count: 'the day counter',
	kind: 'the type',
	name: 'the name',
	description: 'the description',
	purpose: 'the type',
	coverFileId: 'the cover image',
	background: 'the background'
};

export type ActivityLine = {
	/** e.g. "updated the date" — shown after the actor's name */
	action: string;
	/** Optional extra line: a comment, or "Previous → New" dates */
	detail?: string;
	/** Previous and new date, for date changes */
	dates?: { before: string; after: string };
};

type DateShape = { allDay: boolean; startAt: number | null; endAt: number | null; tz: string };
const when = (d: DateShape, tz: string) =>
	formatEventWhen(
		{ allDay: d.allDay, startAt: d.startAt, endAt: d.endAt, startTz: d.tz, endTz: d.tz },
		tz
	);

export function describeActivity(
	a: ClientActivity,
	tz: string,
	memberName: (id: string) => string
): ActivityLine {
	const d = a.data;
	const thing = a.type.startsWith('memo') || a.event?.kind === 'memo' ? 'memo' : 'event';
	switch (a.type) {
		case 'event_created':
		case 'memo_created':
			return {
				action: d.copiedFrom
					? `copied an ${thing}`
					: `created a${thing === 'event' ? 'n' : ''} ${thing}`
			};
		case 'event_deleted':
		case 'memo_deleted':
			return {
				action:
					d.scope === 'this'
						? 'deleted one occurrence of an event'
						: d.scope === 'future'
							? 'deleted later occurrences of an event'
							: `deleted a${thing === 'event' ? 'n' : ''} ${thing}`
			};
		case 'event_updated':
		case 'memo_updated': {
			if (d.item) return { action: `${d.done ? 'ticked' : 'unticked'} "${d.item}"` };
			if (d.converted === 'memo') return { action: 'changed an event into a memo' };
			if (d.converted === 'event') return { action: 'changed a memo into an event' };
			const fields = (d.fields as string[] | undefined) ?? [];
			const line: ActivityLine = {
				action:
					fields.length === 1
						? `updated ${FIELD_NAMES[fields[0]] ?? 'the ' + thing}`
						: `updated the ${thing}`
			};
			if (fields.includes('date') && d.before && d.after) {
				line.dates = {
					before: when(d.before as DateShape, tz),
					after: when(d.after as DateShape, tz)
				};
			}
			if (d.scope === 'this') line.detail = 'Only this occurrence';
			if (d.scope === 'future') line.detail = 'This and future occurrences';
			return line;
		}
		case 'comment':
			return { action: 'commented', detail: String(d.body ?? '') };
		case 'like':
			return { action: `liked an ${thing}` };
		case 'member_joined':
			return { action: 'joined the calendar' };
		case 'member_left':
			return { action: 'left the calendar' };
		case 'member_removed':
			return { action: `removed ${d.memberId ? memberName(String(d.memberId)) : 'a member'}` };
		case 'calendar_updated': {
			if (d.imported)
				return {
					action: `imported ${Number(d.imported).toLocaleString()} events from ${String(d.source ?? 'another app')}`
				};
			const fields = (d.fields as string[] | undefined) ?? [];
			return {
				action:
					fields.length === 1
						? `updated the calendar's ${(FIELD_NAMES[fields[0]] ?? 'settings').replace(/^the /, '')}`
						: 'updated the calendar settings'
			};
		}
		default:
			return { action: 'made a change' };
	}
}

/** "Today", "Yesterday", or "Mon, Oct 5" for grouping by local day. */
export function dayLabel(
	dayKeyValue: string,
	todayValue: string,
	yesterdayValue: string,
	format: (k: string) => string
) {
	if (dayKeyValue === todayValue) return 'Today';
	if (dayKeyValue === yesterdayValue) return 'Yesterday';
	return format(dayKeyValue);
}
