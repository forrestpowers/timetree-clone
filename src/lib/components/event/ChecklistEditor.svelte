<script lang="ts">
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { toast } from '#lib/toast.svelte.js';

	type Item = { id?: string; text: string; done: boolean };
	let { items = $bindable() }: { items: Item[] } = $props();
	let newItem = $state('');

	function addItem() {
		const text = newItem.trim();
		if (!text) return;
		if (items.length >= 100) return toast('No more items can be added.', 'error');
		items = [...items, { text: text.slice(0, 200), done: false }];
		newItem = '';
	}
</script>

<p class="section-title flex items-center gap-1.5"><ListChecks size={14} /> To-do list</p>
<div class="divide-y divide-border border-y border-border bg-surface">
	{#each items as item, i (i)}
		<div class="flex items-center gap-3 px-4 py-2">
			<input
				type="checkbox"
				class="size-5 rounded text-accent"
				bind:checked={item.done}
				aria-label="Done"
			/>
			<input
				class={[
					'min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0',
					item.done && 'text-muted line-through'
				]}
				maxlength="200"
				bind:value={item.text}
			/>
			<button
				class="icon-btn size-8 text-muted"
				onclick={() => (items = items.filter((_, j) => j !== i))}
				aria-label="Remove item"><X size={16} /></button
			>
		</div>
	{/each}
	<form
		class="flex items-center gap-3 px-4 py-2"
		onsubmit={(e) => {
			e.preventDefault();
			addItem();
		}}
	>
		<Plus size={20} class="text-muted" />
		<input
			class="min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0"
			placeholder="Add an item"
			maxlength="200"
			bind:value={newItem}
			onblur={addItem}
		/>
	</form>
</div>
