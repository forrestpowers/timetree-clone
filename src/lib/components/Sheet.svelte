<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	let {
		open = $bindable(false),
		title = '',
		onclose,
		children,
		footer
	}: {
		open?: boolean;
		title?: string;
		onclose?: () => void;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	let dragY = $state(0);
	let startY: number | null = null;

	function close() {
		open = false;
		onclose?.();
	}

	function onkeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') close();
	}

	// Pull the handle down to dismiss
	function down(e: PointerEvent) {
		startY = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (startY != null) dragY = Math.max(0, e.clientY - startY);
	}
	function up() {
		if (dragY > 90) close();
		dragY = 0;
		startY = null;
	}
</script>

<svelte:window {onkeydown} />

{#if open}
	<div
		class="fixed inset-0 z-40 bg-[var(--scrim)]"
		transition:fade={{ duration: 150 }}
		onclick={close}
		aria-hidden="true"
	></div>
	<div
		class="pb-safe fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] max-w-xl flex-col rounded-t-3xl bg-surface shadow-2xl"
		style:transform="translateY({dragY}px)"
		transition:fly={{ y: 400, duration: 220 }}
		role="dialog"
		aria-modal="true"
		aria-label={title || undefined}
	>
		<div
			class="flex touch-none justify-center pt-2.5 pb-1"
			role="presentation"
			onpointerdown={down}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
		>
			<div class="h-1.5 w-10 rounded-full bg-border"></div>
		</div>
		{#if title}<h2 class="px-5 pt-1 pb-2 text-base font-semibold">{title}</h2>{/if}
		<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
			{@render children()}
		</div>
		{#if footer}<div class="border-t border-border p-3">{@render footer()}</div>{/if}
	</div>
{/if}
