<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Sheet from './Sheet.svelte';
	import type { ClientCalendar } from '#lib/types.js';

	let {
		calendars,
		scopeId,
		base,
		title
	}: { calendars: ClientCalendar[]; scopeId: string; base: string; title: string } = $props();

	let open = $state(false);
	const current = $derived(calendars.find((c) => c.id === scopeId)?.name ?? 'All Calendars');
</script>

<button
	class="flex min-w-0 items-center gap-1 rounded-lg px-2 py-1 text-left hover:bg-surface-2"
	onclick={() => (open = true)}
>
	<span class="min-w-0">
		<span class="block text-[17px] leading-tight font-bold">{title}</span>
		<span class="block truncate text-xs text-muted">{current}</span>
	</span>
	<ChevronDown size={18} class="shrink-0 text-muted" />
</button>

<Sheet bind:open title="Show">
	<div class="divide-y divide-border border-t border-border">
		<a href="{base}?c=all" class="list-row" onclick={() => (open = false)}>
			<span class="flex-1 font-medium">All Calendars</span>
			{#if scopeId === 'all'}<Check size={18} class="text-accent" />{/if}
		</a>
		{#each calendars as c (c.id)}
			<a href="{base}?c={c.id}" class="list-row" onclick={() => (open = false)}>
				<span class="flex-1 truncate font-medium">{c.name}</span>
				{#if scopeId === c.id}<Check size={18} class="text-accent" />{/if}
			</a>
		{/each}
	</div>
</Sheet>
