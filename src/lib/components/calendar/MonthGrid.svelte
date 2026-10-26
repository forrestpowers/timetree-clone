<script lang="ts">
	import { layoutMonth } from '#lib/month-layout.js';
	import { textOn } from '#lib/palette.js';
	import { weekday, weekdayNames } from '#lib/dates.js';
	import type { CalendarItem } from '#lib/calendar-items.js';

	let {
		days,
		month,
		items,
		tz,
		today,
		selected,
		weekStart,
		saturdayBlue = true,
		onselect,
		onswipe,
		onlongpress,
		ondrop
	}: {
		days: string[];
		month: string;
		items: CalendarItem[];
		tz: string;
		today: string;
		selected: string | null;
		weekStart: number;
		saturdayBlue?: boolean;
		onselect: (day: string) => void;
		onswipe: (delta: number) => void;
		/** Long press on a day (not on an event) */
		onlongpress: (day: string) => void;
		/** An event was dragged from one day to another */
		ondrop: (item: CalendarItem, fromDay: string, toDay: string) => void;
	} = $props();

	const HEADER = 20;
	const LANE = 17;
	const LONG_PRESS_MS = 450;
	let gridEl: HTMLDivElement;
	let gridHeight = $state(576);
	const rowHeight = $derived(gridHeight / 6);
	const maxLanes = $derived(Math.max(1, Math.floor((rowHeight - HEADER - 2) / LANE)));
	const weeks = $derived(layoutMonth(days, items, tz, maxLanes));

	const dayColor = (key: string) => {
		const wd = weekday(key);
		if (wd === 0) return 'text-sunday';
		if (wd === 6 && saturdayBlue) return 'text-saturday';
		return '';
	};

	// ---- gestures: tap selects, horizontal swipe changes month, long press creates or drags ----
	let press: {
		x: number;
		y: number;
		timer: ReturnType<typeof setTimeout> | null;
		long: boolean;
	} | null = null;
	let drag = $state<{
		item: CalendarItem;
		from: string;
		over: string | null;
		x: number;
		y: number;
	} | null>(null);
	let suppressClick = false;

	function cellAt(x: number, y: number) {
		const r = gridEl.getBoundingClientRect();
		const col = Math.floor(((x - r.left) / r.width) * 7);
		const row = Math.floor(((y - r.top) / r.height) * 6);
		if (col < 0 || col > 6 || row < 0 || row > 5) return null;
		return { row, col, day: days[row * 7 + col], rowTop: r.top + row * (r.height / 6) };
	}

	function itemAt(x: number, y: number) {
		const cell = cellAt(x, y);
		if (!cell) return null;
		const lane = Math.floor((y - cell.rowTop - HEADER) / LANE);
		if (lane < 0) return null;
		const bar = weeks[cell.row].bars.find(
			(b) => b.lane === lane && cell.col >= b.col && cell.col < b.col + b.span
		);
		return bar && bar.item.event ? bar.item : null;
	}

	function down(e: PointerEvent) {
		if (e.button !== 0) return;
		const x = e.clientX;
		const y = e.clientY;
		press = {
			x,
			y,
			long: false,
			timer: setTimeout(() => {
				if (!press) return;
				press.long = true;
				navigator.vibrate?.(10);
				const item = itemAt(x, y);
				const cell = cellAt(x, y);
				if (!cell) return;
				if (item) {
					drag = { item, from: cell.day, over: cell.day, x, y };
					gridEl.setPointerCapture(e.pointerId);
				} else {
					suppressClick = true;
					onlongpress(cell.day);
				}
			}, LONG_PRESS_MS)
		};
	}

	function move(e: PointerEvent) {
		if (!press) return;
		if (drag) {
			drag.x = e.clientX;
			drag.y = e.clientY;
			drag.over = cellAt(e.clientX, e.clientY)?.day ?? null;
			return;
		}
		if (!press.long && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8 && press.timer) {
			clearTimeout(press.timer);
			press.timer = null;
		}
	}

	function up(e: PointerEvent) {
		if (!press) return;
		if (press.timer) clearTimeout(press.timer);
		if (drag) {
			const { item, from, over } = drag;
			drag = null;
			suppressClick = true;
			if (over && over !== from) ondrop(item, from, over);
		} else if (!press.long) {
			const dx = e.clientX - press.x;
			const dy = e.clientY - press.y;
			if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
				suppressClick = true;
				onswipe(dx < 0 ? 1 : -1);
			}
		}
		press = null;
	}

	function cancel() {
		if (press?.timer) clearTimeout(press.timer);
		press = null;
		drag = null;
	}

	function click(day: string) {
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		onselect(day);
	}
</script>

<div class="flex h-full flex-col select-none [-webkit-touch-callout:none]">
	<div class="grid grid-cols-7 border-b border-border text-center text-[11px] font-medium">
		{#each weekdayNames(weekStart) as name, i (name)}
			{@const wd = (weekStart + i) % 7}
			<div
				class={[
					'py-1',
					wd === 0 ? 'text-sunday' : wd === 6 && saturdayBlue ? 'text-saturday' : 'text-muted'
				]}
			>
				{name}
			</div>
		{/each}
	</div>

	<div
		bind:this={gridEl}
		class="grid min-h-0 flex-1 touch-none grid-rows-6"
		bind:clientHeight={gridHeight}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={cancel}
		oncontextmenu={(e) => e.preventDefault()}
		role="presentation"
	>
		{#each weeks as week (week.days[0])}
			<div class="relative border-b border-border last:border-b-0">
				<div class="absolute inset-0 grid grid-cols-7">
					{#each week.days as day, c (day)}
						<button
							type="button"
							class={[
								'relative flex flex-col items-center border-r border-border pt-0.5 last:border-r-0',
								day.slice(0, 7) !== month && 'bg-surface-2/60',
								selected === day && 'bg-accent-soft',
								drag?.over === day && 'bg-accent-soft ring-2 ring-accent ring-inset'
							]}
							onclick={() => click(day)}
							aria-label={day}
						>
							<span
								class={[
									'flex size-[18px] items-center justify-center rounded-full text-[11px] leading-none font-semibold',
									day === today ? 'bg-accent text-on-accent' : dayColor(day),
									day.slice(0, 7) !== month && day !== today && 'opacity-45'
								]}
							>
								{Number(day.slice(8))}
							</span>
							{#if week.hidden[c]}
								<span
									class="absolute inset-x-0.5 text-center text-[10px] font-semibold text-muted"
									style:top="{HEADER + (maxLanes - 1) * LANE}px">+{week.hidden[c]}</span
								>
							{/if}
						</button>
					{/each}
				</div>
				{#each week.bars as bar (bar.item.id + ':' + bar.col)}
					<div
						class={[
							'pointer-events-none absolute flex items-center gap-0.5 truncate px-1 text-[11px] leading-[15px] font-medium',
							bar.continuesBefore ? 'rounded-l-none' : 'rounded-l-[3px]',
							bar.continuesAfter ? 'rounded-r-none' : 'rounded-r-[3px]',
							drag?.item.id === bar.item.id && 'opacity-40'
						]}
						style:left="calc({(bar.col * 100) / 7}% + {bar.continuesBefore ? 0 : 1.5}px)"
						style:width="calc({(bar.span * 100) / 7}% - {(bar.continuesBefore ? 0 : 1.5) +
							(bar.continuesAfter ? 0 : 1.5)}px)"
						style:top="{HEADER + bar.lane * LANE}px"
						style:height="{LANE - 2}px"
						style:background={bar.item.color}
						style:color={textOn(bar.item.color)}
					>
						{#if bar.item.pinned}<span class="shrink-0 text-[9px]">📌</span>{/if}
						<span class="truncate">{bar.item.title}</span>
						{#if bar.item.folded}<span
								class="ml-auto shrink-0 rounded-sm bg-black/20 px-0.5 text-[9px]"
								>+{bar.item.folded}</span
							>{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>
</div>

{#if drag}
	<div
		class="pointer-events-none fixed z-50 max-w-40 truncate rounded-md px-2 py-1 text-xs font-semibold shadow-lg"
		style:left="{drag.x + 8}px"
		style:top="{drag.y - 28}px"
		style:background={drag.item.color}
		style:color={textOn(drag.item.color)}
	>
		{drag.item.title}
	</div>
{/if}
