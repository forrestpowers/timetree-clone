<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import X from '@lucide/svelte/icons/x';

	let {
		title,
		back,
		close = false,
		actions
	}: { title: string; back?: string | (() => void); close?: boolean; actions?: Snippet } = $props();
</script>

{#snippet icon()}
	{#if close}<X size={22} />{:else}<ChevronLeft size={24} />{/if}
{/snippet}

<header class="pt-safe sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
	<div class="flex h-13 items-center gap-1 px-1.5">
		{#if typeof back === 'string'}
			<a class="icon-btn" href={back} aria-label={close ? 'Close' : 'Back'}>{@render icon()}</a>
		{:else if back}
			<button class="icon-btn" onclick={back} aria-label={close ? 'Close' : 'Back'}
				>{@render icon()}</button
			>
		{:else}
			<div class="w-2"></div>
		{/if}
		<h1 class="min-w-0 flex-1 truncate text-[17px] font-semibold">{title}</h1>
		{#if actions}<div class="flex items-center gap-1 pr-1">{@render actions()}</div>{/if}
	</div>
</header>
