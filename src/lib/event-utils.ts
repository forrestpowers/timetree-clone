import { DAY_MS, dateToUtcMs } from '#lib/dates.js';
import type { ClientEvent, DayCount } from '#lib/types.js';

/** Pinned for all occurrences, or for this specific occurrence. */
export const isPinned = (
	e: Pick<ClientEvent, 'pinnedAt' | 'pinnedOccurrences'>,
	occurrenceStartAt: number | null
) => !!e.pinnedAt || (occurrenceStartAt != null && e.pinnedOccurrences.includes(occurrenceStartAt));

/** "12 days left", "Today is the day", "Day 100" — relative to `today` (both 'YYYY-MM-DD'). */
export function dayCountText(dayCount: DayCount, eventDay: string, today: string): string {
	const diff = Math.round((dateToUtcMs(eventDay) - dateToUtcMs(today)) / DAY_MS);
	if (dayCount.mode === 'until') {
		if (diff > 0) return `${diff.toLocaleString()} day${diff === 1 ? '' : 's'} left`;
		if (diff === 0) return 'Today is the day';
		return `${(-diff).toLocaleString()} day${diff === -1 ? '' : 's'} ago`;
	}
	if (diff > 0) return `Starts in ${diff.toLocaleString()} day${diff === 1 ? '' : 's'}`;
	return `Day ${(1 - diff).toLocaleString()}`;
}
