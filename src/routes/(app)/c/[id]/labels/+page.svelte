<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { api } from '#lib/api.js';
	import { ALL_COLORS, LABEL_COLORS, colorName } from '#lib/palette.js';
	import { sortable } from '#lib/sortable.js';
	import { toast } from '#lib/toast.svelte.js';
	import ColorPicker from '#lib/components/ColorPicker.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Row = { key: string; id?: string; name: string; color: string };
	// Deeply reactive local copy (rows are edited in place), reset when the server data changes
	// eslint-disable-next-line svelte/prefer-writable-derived
	let rows = $state<Row[]>([]);
	$effect.pre(() => {
		rows = data.labels.map((l) => ({ key: l.id, id: l.id, name: l.name, color: l.color }));
	});
	let dirty = $state(false);
	let editing = $state<Row | null>(null);
	let pickerOpen = $state(false);

	function reorder(keys: string[]) {
		rows = keys.map((k) => rows.find((r) => r.key === k)!);
		dirty = true;
	}

	function add() {
		const used = new Set(rows.map((r) => r.color.toLowerCase()));
		const color = (ALL_COLORS.find((c) => !used.has(c.hex.toLowerCase())) ?? LABEL_COLORS[0]).hex;
		rows.push({ key: crypto.randomUUID(), name: '', color });
		dirty = true;
	}

	function remove(row: Row) {
		if (rows.length <= 1) return toast('Keep at least one label.', 'error');
		if (row.id && !confirm('Delete this label? Events using it will have no label.')) return;
		rows = rows.filter((r) => r !== row);
		dirty = true;
	}

	async function save() {
		try {
			await api(
				`/api/calendars/${data.calendarId}/labels`,
				'PUT',
				rows.map(({ id, name, color }) => ({ id, name, color }))
			);
			dirty = false;
			toast('Label settings saved');
		} catch (e) {
			toast((e as Error).message, 'error');
		}
	}

	beforeNavigate(({ cancel }) => {
		if (dirty && !confirm('Discard your label changes?')) cancel();
	});
</script>

<svelte:head><title>Label management</title></svelte:head>

<PageHeader title="Label Management" back="/c/{data.calendarId}/settings">
	{#snippet actions()}
		<button class="btn btn-ghost !px-3 !py-1.5" onclick={save} disabled={!dirty}>Save</button>
	{/snippet}
</PageHeader>

<main class="mx-auto max-w-xl pb-10">
	<p class="px-4 pt-4 text-sm text-muted">
		Name labels by person or type of event ("Mom", "Work", "Kids") so everyone can tell at a glance
		whose event it is.
	</p>

	<ul class="mt-4 divide-y divide-border border-y border-border bg-surface" use:sortable={reorder}>
		{#each rows as row (row.key)}
			<li data-sort-id={row.key} class="flex items-center gap-2 bg-surface py-1.5 pr-2 pl-1">
				<button data-sort-handle class="touch-none p-2 text-muted" aria-label="Drag to reorder"
					><GripVertical size={18} /></button
				>
				<button
					class="size-8 shrink-0 rounded-full"
					style:background={row.color}
					aria-label="Color: {colorName(row.color)}"
					onclick={() => {
						editing = row;
						pickerOpen = true;
					}}
				></button>
				<input
					class="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 focus:ring-0"
					placeholder={colorName(row.color)}
					maxlength="30"
					bind:value={row.name}
					oninput={() => (dirty = true)}
				/>
				<button class="icon-btn text-muted" onclick={() => remove(row)} aria-label="Delete label"
					><Trash2 size={18} /></button
				>
			</li>
		{/each}
	</ul>
	<button class="list-row border-b border-border bg-surface text-accent" onclick={add}
		><Plus size={20} /> Add label</button
	>
</main>

<Sheet bind:open={pickerOpen} title="Choose event color">
	{#if editing}
		<ColorPicker
			value={editing.color}
			onpick={(hex) => {
				editing!.color = hex;
				dirty = true;
				pickerOpen = false;
			}}
		/>
	{/if}
</Sheet>
