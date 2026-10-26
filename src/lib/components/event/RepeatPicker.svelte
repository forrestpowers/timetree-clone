<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import {
		describeRepeat,
		isRecurring,
		repeatPresets,
		ruleToSpec,
		specToRule,
		type Frequency,
		type RepeatSpec
	} from '#lib/recurrence.js';

	let {
		recurrence,
		startDate,
		onchange
	}: { recurrence: string[]; startDate: string; onchange: (lines: string[]) => void } = $props();

	const presets = $derived(repeatPresets(startDate));
	const others = $derived(recurrence.filter((l) => !/^RRULE[:;]/i.test(l)));
	const currentRule = $derived(recurrence.find((l) => /^RRULE[:;]/i.test(l)) ?? null);

	let custom = $state(false);
	const weekdayOfStart = $derived(new Date(`${startDate}T00:00:00Z`).getUTCDay());
	let spec = $state<RepeatSpec>({
		freq: 'weekly',
		interval: 1,
		weekdays: [],
		monthlyBy: 'date',
		end: { type: 'never' }
	});

	function choose(next: RepeatSpec | null) {
		// Keep exception lines (EXDATE) when only the pattern changes
		onchange(next ? [specToRule(next, startDate), ...others] : []);
	}

	function openCustom() {
		const parsed = isRecurring({ recurrence }) ? ruleToSpec(recurrence) : null;
		spec = parsed ?? {
			freq: 'weekly',
			interval: 1,
			weekdays: [weekdayOfStart],
			monthlyBy: 'date',
			end: { type: 'never' }
		};
		if (spec.freq === 'weekly' && !spec.weekdays.length) spec.weekdays = [weekdayOfStart];
		custom = true;
	}

	function toggleDay(d: number) {
		spec.weekdays = spec.weekdays.includes(d)
			? spec.weekdays.filter((x) => x !== d)
			: [...spec.weekdays, d];
		if (!spec.weekdays.length) spec.weekdays = [weekdayOfStart];
	}

	const FREQS: { id: Frequency; label: string; unit: string }[] = [
		{ id: 'daily', label: 'Daily', unit: 'day' },
		{ id: 'weekly', label: 'Weekly', unit: 'week' },
		{ id: 'monthly', label: 'Monthly', unit: 'month' },
		{ id: 'yearly', label: 'Yearly', unit: 'year' }
	];
	const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
	const unit = $derived(FREQS.find((f) => f.id === spec.freq)!.unit);
	const previewRule = $derived(specToRule(spec, startDate));
</script>

{#if !custom}
	<div class="divide-y divide-border">
		<button class="list-row" onclick={() => choose(null)}>
			<span class="flex-1 text-left">Not repeating</span>
			{#if !currentRule}<Check size={18} class="text-accent" />{/if}
		</button>
		{#each presets as p (p.label)}
			{@const rule = specToRule(p.spec, startDate)}
			<button class="list-row" onclick={() => choose(p.spec)}>
				<span class="flex-1 text-left">{p.label}</span>
				{#if currentRule === rule}<Check size={18} class="text-accent" />{/if}
			</button>
		{/each}
		<button class="list-row" onclick={openCustom}>
			<span class="flex-1 text-left">Custom…</span>
			{#if currentRule && !presets.some((p) => specToRule(p.spec, startDate) === currentRule)}
				<span class="max-w-48 truncate text-xs text-muted"
					>{describeRepeat(recurrence, startDate)}</span
				>
				<Check size={18} class="text-accent" />
			{/if}
		</button>
	</div>
{:else}
	<div class="space-y-5 px-4 pb-4">
		<button class="-ml-2 flex items-center text-sm text-accent" onclick={() => (custom = false)}
			><ChevronLeft size={18} /> Presets</button
		>

		<div class="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
			{#each FREQS as f (f.id)}
				<button
					class={[
						'rounded-lg py-1.5 text-sm font-medium',
						spec.freq === f.id ? 'bg-surface shadow-sm' : 'text-muted'
					]}
					onclick={() => {
						spec.freq = f.id;
						if (f.id === 'weekly' && !spec.weekdays.length) spec.weekdays = [weekdayOfStart];
					}}>{f.label}</button
				>
			{/each}
		</div>

		<label class="flex items-center gap-3 text-sm">
			Every
			<input
				class="field !w-20 !py-1.5 text-center"
				type="number"
				min="1"
				max="99"
				bind:value={spec.interval}
			/>
			{unit}{spec.interval > 1 ? 's' : ''}
		</label>

		{#if spec.freq === 'weekly'}
			<div class="flex justify-between">
				{#each DAY_LETTERS as letter, d (d)}
					<button
						class={[
							'size-10 rounded-full text-sm font-semibold',
							spec.weekdays.includes(d) ? 'bg-accent text-on-accent' : 'bg-surface-2'
						]}
						onclick={() => toggleDay(d)}
						aria-pressed={spec.weekdays.includes(d)}>{letter}</button
					>
				{/each}
			</div>
		{/if}

		{#if spec.freq === 'monthly'}
			<div class="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 text-sm">
				<button
					class={[
						'rounded-lg py-1.5',
						spec.monthlyBy === 'date' ? 'bg-surface shadow-sm' : 'text-muted'
					]}
					onclick={() => (spec.monthlyBy = 'date')}>Same date</button
				>
				<button
					class={[
						'rounded-lg py-1.5',
						spec.monthlyBy === 'weekday' ? 'bg-surface shadow-sm' : 'text-muted'
					]}
					onclick={() => (spec.monthlyBy = 'weekday')}>Same weekday</button
				>
			</div>
		{/if}

		<div class="space-y-2 text-sm">
			<p class="font-medium">Ends</p>
			<label class="flex items-center gap-2"
				><input
					type="radio"
					checked={spec.end.type === 'never'}
					onchange={() => (spec.end = { type: 'never' })}
					class="text-accent"
				/> Never</label
			>
			<label class="flex items-center gap-2">
				<input
					type="radio"
					checked={spec.end.type === 'until'}
					onchange={() => (spec.end = { type: 'until', date: startDate })}
					class="text-accent"
				/>
				On
				{#if spec.end.type === 'until'}
					<input
						class="field !w-auto !py-1"
						type="date"
						min={startDate}
						bind:value={spec.end.date}
					/>
				{/if}
			</label>
			<label class="flex items-center gap-2">
				<input
					type="radio"
					checked={spec.end.type === 'count'}
					onchange={() => (spec.end = { type: 'count', count: 10 })}
					class="text-accent"
				/>
				After
				{#if spec.end.type === 'count'}
					<input
						class="field !w-20 !py-1 text-center"
						type="number"
						min="1"
						max="999"
						bind:value={spec.end.count}
					/> times
				{/if}
			</label>
		</div>

		<p class="rounded-xl bg-accent-soft p-3 text-sm">{describeRepeat([previewRule], startDate)}</p>
		<button
			class="btn btn-primary w-full"
			onclick={() =>
				choose({ ...spec, interval: Math.max(1, Math.min(99, Math.round(spec.interval) || 1)) })}
			>Use this repeat</button
		>
	</div>
{/if}
