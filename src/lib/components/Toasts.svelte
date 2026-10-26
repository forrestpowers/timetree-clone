<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toasts } from '#lib/toast.svelte.js';
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4"
	aria-live="polite"
>
	{#each toasts as t (t.id)}
		<div
			transition:fly={{ y: 20, duration: 180 }}
			class={[
				'rounded-full px-4 py-2.5 text-sm font-medium shadow-lg',
				t.tone === 'error' ? 'bg-danger text-white' : 'bg-text text-bg'
			]}
		>
			{t.text}
		</div>
	{/each}
</div>
