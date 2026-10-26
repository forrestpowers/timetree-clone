<script lang="ts">
	import { invalidate } from '$app/navigation';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Plus from '@lucide/svelte/icons/plus';
	import Users from '@lucide/svelte/icons/users';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { api } from '#lib/api.js';
	import { purposeOf } from '#lib/meta.js';
	import { sortable } from '#lib/sortable.js';
	import { toast } from '#lib/toast.svelte.js';
	import Toggle from '#lib/components/Toggle.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let editing = $state(false);

	// Local copy so reordering feels instant
	let order = $derived(data.calendars.map((c) => c.id));
	const ordered = $derived(
		order.map((id) => data.calendars.find((c) => c.id === id)!).filter(Boolean)
	);

	async function saveOrder(ids: string[]) {
		order = ids;
		try {
			await api('/api/calendars/order', 'PUT', ids);
			await invalidate('app:calendars');
		} catch (e) {
			toast((e as Error).message, 'error');
		}
	}

	async function setVisible(id: string, visible: boolean) {
		try {
			await api(`/api/calendars/${id}`, 'PATCH', { visible });
			await invalidate('app:calendars');
		} catch (e) {
			toast((e as Error).message, 'error');
		}
	}
</script>

<svelte:head><title>Calendars</title></svelte:head>

<header class="pt-safe sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
	<div class="flex h-13 items-center px-4">
		<h1 class="flex-1 text-[17px] font-semibold">Calendar List</h1>
		<button class="btn btn-ghost !px-2 !py-1" onclick={() => (editing = !editing)}
			>{editing ? 'Done' : 'Arrange'}</button
		>
	</div>
</header>

<main class="mx-auto max-w-xl pb-6">
	<a href="/c/all" class="list-row mt-3 bg-surface">
		<span class="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-xl"
			>🗂️</span
		>
		<span class="flex-1">
			<span class="block font-semibold">All Calendars</span>
			<span class="text-xs text-muted">Shows events from every calendar turned on below</span>
		</span>
		<ChevronRight size={18} class="text-muted" />
	</a>

	<p class="section-title">Calendars ({data.calendars.length})</p>
	<ul class="divide-y divide-border border-y border-border bg-surface" use:sortable={saveOrder}>
		{#each ordered as cal (cal.id)}
			<li data-sort-id={cal.id} class="bg-surface">
				<div class="list-row">
					{#if editing}
						<button data-sort-handle class="touch-none p-1 text-muted" aria-label="Drag to reorder"
							><GripVertical size={20} /></button
						>
					{/if}
					<a href="/c/{cal.id}" class="flex min-w-0 flex-1 items-center gap-3">
						{#if cal.coverFileId}
							<img src="/files/{cal.coverFileId}" alt="" class="size-10 rounded-xl object-cover" />
						{:else}
							<span class="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-xl"
								>{purposeOf(cal.purpose).emoji}</span
							>
						{/if}
						<span class="min-w-0 flex-1">
							<span class="block truncate font-semibold">{cal.name}</span>
							<span class="flex items-center gap-1 text-xs text-muted"
								><Users size={12} /> {cal.memberCount}</span
							>
						</span>
					</a>
					{#if !editing}
						<Toggle
							label="Show in All Calendars"
							checked={cal.me.visible}
							onchange={(v) => setVisible(cal.id, v)}
						/>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
	<p class="px-4 pt-2 text-xs text-muted">
		The switch controls whether a calendar appears in All Calendars and in the daily summary
		notification.
	</p>

	<a href="/calendars/new" class="btn btn-secondary mx-4 mt-6 flex"
		><Plus size={18} /> Create Calendar</a
	>
</main>
