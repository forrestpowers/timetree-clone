import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { utcMsToDate, formatDayKey } from '#lib/dates.js';
import type { ClientEvent } from '#lib/types.js';

/** "Mon, Oct 5, 2026" / "Mon, Oct 5 – Wed, Oct 7, 2026" / "Mon, Oct 5, 2026 · 09:00 – 10:30" */
export function formatEventWhen(
	e: Pick<ClientEvent, 'allDay' | 'startAt' | 'endAt' | 'startTz' | 'endTz'>,
	tz: string
): string {
	if (e.startAt == null) return '';
	const end = e.endAt ?? e.startAt;
	if (e.allDay) {
		const s = utcMsToDate(e.startAt);
		const t = utcMsToDate(end);
		if (s === t) return formatDayKey(s, 'EEE, MMM d, yyyy');
		const sameYear = s.slice(0, 4) === t.slice(0, 4);
		return `${formatDayKey(s, sameYear ? 'EEE, MMM d' : 'EEE, MMM d, yyyy')} – ${formatDayKey(t, 'EEE, MMM d, yyyy')}`;
	}
	const start = new TZDate(e.startAt, tz);
	const finish = new TZDate(end, tz);
	const sameDay = format(start, 'yyyy-MM-dd') === format(finish, 'yyyy-MM-dd');
	if (sameDay)
		return `${format(start, 'EEE, MMM d, yyyy')} · ${format(start, 'HH:mm')} – ${format(finish, 'HH:mm')}`;
	return `${format(start, 'EEE, MMM d, HH:mm')} – ${format(finish, 'EEE, MMM d, yyyy, HH:mm')}`;
}

export function mapsUrl(
	e: Pick<ClientEvent, 'locationName' | 'locationLat' | 'locationLon'>,
	app: 'apple' | 'google' = 'google'
) {
	const q =
		e.locationLat != null && e.locationLon != null
			? `${e.locationLat},${e.locationLon}`
			: e.locationName;
	return app === 'apple'
		? `https://maps.apple.com/?q=${encodeURIComponent(q)}`
		: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
