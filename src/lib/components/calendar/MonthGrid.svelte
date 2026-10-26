<script lang="ts">
	import { layoutMonth } from '#lib/month-layout.js';
	import { textOn } from '#lib/palette.js';
	import { weekday, weekdayNames } from '#lib/dates.js';
	import type { ClientEvent } from '#lib/types.js';

	let {
		days,
		month,
		events,
		tz,
		today,
		selected,
		weekStart,
		saturdayBlue = true,
		colorOf,
		onselect,
		onswipe
	}: {
		days: string[];
		month: string;
		events: ClientEvent[];
		tz: string;
		today: string;
		selected: string | null;
		weekStart: number;
		saturdayBlue?: boolean;
		colorOf: (e: ClientEvent) => string;
		onselect: (day: string) => void;
		onswipe: (delta: number) => void;
	} = $props();

	const HEADER = 20;
	const LANE = 17;
	let gridHeight = $state(576);
	const rowHeight = $derived(gridHeight / 6);
	const maxLanes = $derived(Math.max(1, Math.floor((rowHeight - HEADER - 2) / LANE)));
	const weeks = $derived(layoutMonth(days, events, tz, maxLanes));

	const dayColor = (key: string) => {
		const wd = weekday(key);
		if (wd === 0) return 'text-sunday';
		if (wd === 6 && saturdayBlue) return 'text-saturday';
		return '';
	};

	// Horizontal swipe changes month
	let start: { x: number; y: number } | null = null;
	function down(e: PointerEvent) {
		start = { x: e.clientX, y: e.clientY };
	}
	function up(e: PointerEvent) {
		if (!start) return;
		const dx = e.clientX - start.x;
		const dy = e.clientY - start.y;
		start = null;
		if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onswipe(dx < 0 ? 1 : -1);
	}
</script>

<div class="flex h-full flex-col select-none">
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
		class="grid min-h-0 flex-1 touch-pan-y grid-rows-6"
		bind:clientHeight={gridHeight}
		onpointerdown={down}
		onpointerup={up}
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
								selected === day && 'bg-accent-soft'
							]}
							onclick={() => onselect(day)}
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
					{@const color = colorOf(bar.item)}
					<div
						class={[
							'pointer-events-none absolute truncate px-1 text-[11px] leading-[15px] font-medium',
							bar.continuesBefore ? 'rounded-l-none' : 'rounded-l-[3px]',
							bar.continuesAfter ? 'rounded-r-none' : 'rounded-r-[3px]'
						]}
						style:left="calc({(bar.col * 100) / 7}% + {bar.continuesBefore ? 0 : 1.5}px)"
						style:width="calc({(bar.span * 100) / 7}% - {(bar.continuesBefore ? 0 : 1.5) +
							(bar.continuesAfter ? 0 : 1.5)}px)"
						style:top="{HEADER + bar.lane * LANE}px"
						style:height="{LANE - 2}px"
						style:background={color}
						style:color={textOn(color)}
					>
						{bar.item.title}
					</div>
				{/each}
			</div>
		{/each}
	</div>
</div>
