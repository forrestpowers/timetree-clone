import { eventDayRange } from '#lib/dates.js';

export type Placeable = {
	id: string;
	allDay: boolean;
	startAt: number | null;
	endAt: number | null;
	title: string;
};

export type Bar<T> = {
	item: T;
	/** Column within the week, 0-6 */
	col: number;
	span: number;
	lane: number;
	/** The event continues from the previous week / into the next week */
	continuesBefore: boolean;
	continuesAfter: boolean;
};

export type WeekLayout<T> = {
	days: string[];
	bars: Bar<T>[];
	/** Events per column that didn't fit */
	hidden: number[];
	/** Every event touching each column, in display order (for the day list) */
	perDay: T[][];
};

/**
 * Lay out events over a month grid (weeks of 7 day keys) the way a wall calendar
 * does: multi-day and all-day bars first, packed into the lowest free lane.
 * `maxLanes` is how many rows of bars fit in a cell; when a day has more, the last
 * row shows "+n" instead.
 */
export function layoutMonth<T extends Placeable>(
	days: string[],
	items: T[],
	tz: string,
	maxLanes: number
): WeekLayout<T>[] {
	const ranged = items
		.map((item) => ({ item, range: eventDayRange(item, tz) }))
		.filter((x): x is { item: T; range: [string, string] } => x.range !== null);

	const weeks: WeekLayout<T>[] = [];
	for (let w = 0; w < days.length / 7; w++) {
		const weekDays = days.slice(w * 7, w * 7 + 7);
		const first = weekDays[0];
		const last = weekDays[6];

		const inWeek = ranged
			.filter(({ range: [s, e] }) => s <= last && e >= first)
			.map(({ item, range: [s, e] }) => {
				const col = s < first ? 0 : weekDays.indexOf(s);
				const end = e > last ? 6 : weekDays.indexOf(e);
				return { item, col, span: end - col + 1, multi: s !== e, s, e };
			})
			.sort(
				(a, b) =>
					Number(b.multi || b.item.allDay) - Number(a.multi || a.item.allDay) ||
					a.col - b.col ||
					b.span - a.span ||
					(a.item.startAt ?? 0) - (b.item.startAt ?? 0) ||
					a.item.title.localeCompare(b.item.title)
			);

		const lanes: boolean[][] = [];
		const placed = inWeek.map((x) => {
			let lane = 0;
			for (; ; lane++) {
				lanes[lane] ??= Array(7).fill(false);
				let free = true;
				for (let c = x.col; c < x.col + x.span; c++) if (lanes[lane][c]) free = false;
				if (free) break;
			}
			for (let c = x.col; c < x.col + x.span; c++) lanes[lane][c] = true;
			return { ...x, lane };
		});

		const count = Array(7).fill(0);
		for (const p of placed) for (let c = p.col; c < p.col + p.span; c++) count[c]++;
		const visibleLanes = count.map((n) => (n > maxLanes ? Math.max(0, maxLanes - 1) : maxLanes));

		const bars: Bar<T>[] = [];
		const hidden = Array(7).fill(0);
		for (const p of placed) {
			let fits = true;
			for (let c = p.col; c < p.col + p.span; c++) if (p.lane >= visibleLanes[c]) fits = false;
			if (fits) {
				bars.push({
					item: p.item,
					col: p.col,
					span: p.span,
					lane: p.lane,
					continuesBefore: p.s < first,
					continuesAfter: p.e > last
				});
			} else {
				for (let c = p.col; c < p.col + p.span; c++) hidden[c]++;
			}
		}

		const perDay = weekDays.map((_, c) =>
			placed
				.filter((p) => c >= p.col && c < p.col + p.span)
				.sort(
					(a, b) =>
						Number(b.item.allDay || b.multi) - Number(a.item.allDay || a.multi) ||
						(a.item.startAt ?? 0) - (b.item.startAt ?? 0)
				)
				.map((p) => p.item)
		);

		weeks.push({ days: weekDays, bars, hidden, perDay });
	}
	return weeks;
}
