<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { formatMonth, monthGrid, shiftMonth, weekday, weekdayNames } from '#lib/dates.js';

	let {
		month = $bindable(),
		selected,
		weekStart = 0,
		today,
		marked = [],
		ontoggle
	}: {
		month: string;
		selected: Set<string>;
		weekStart?: number;
		today: string;
		/** Days shown with a dot (e.g. the original event) */
		marked?: string[];
		ontoggle: (day: string) => void;
	} = $props();

	const days = $derived(monthGrid(month, weekStart));
</script>

<div class="select-none">
	<div class="flex items-center justify-between px-1 pb-2">
		<button
			class="icon-btn size-9"
			onclick={() => (month = shiftMonth(month, -1))}
			aria-label="Previous month"><ChevronLeft size={20} /></button
		>
		<span class="font-semibold">{formatMonth(month)}</span>
		<button
			class="icon-btn size-9"
			onclick={() => (month = shiftMonth(month, 1))}
			aria-label="Next month"><ChevronRight size={20} /></button
		>
	</div>
	<div class="grid grid-cols-7 text-center text-[11px] text-muted">
		{#each weekdayNames(weekStart) as name (name)}<div class="py-1">{name}</div>{/each}
	</div>
	<div class="grid grid-cols-7 gap-y-1">
		{#each days as day (day)}
			{@const on = selected.has(day)}
			{@const outside = day.slice(0, 7) !== month}
			<button
				class="relative flex h-10 items-center justify-center"
				onclick={() => ontoggle(day)}
				aria-pressed={on}
				aria-label={day}
			>
				<span
					class={[
						'flex size-9 items-center justify-center rounded-full text-sm',
						on
							? 'bg-accent font-semibold text-on-accent'
							: day === today
								? 'font-bold text-accent'
								: '',
						!on && outside && 'opacity-40',
						!on && weekday(day) === 0 && 'text-sunday'
					]}>{Number(day.slice(8))}</span
				>
				{#if marked.includes(day)}<span class="absolute bottom-0.5 size-1 rounded-full bg-muted"
					></span>{/if}
			</button>
		{/each}
	</div>
</div>
