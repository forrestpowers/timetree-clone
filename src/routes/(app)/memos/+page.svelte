<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Plus from '@lucide/svelte/icons/plus';
	import { api } from '#lib/api.js';
	import { openedReadMarkers } from '#lib/read-markers.js';
	import { sortable } from '#lib/sortable.js';
	import { toast } from '#lib/toast.svelte.js';
	import ScopeSwitcher from '#lib/components/ScopeSwitcher.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	onMount(() => {
		invalidate('app:unread');
	});

	const keepOpened = openedReadMarkers();
	const readSince = $derived(keepOpened(data.scopeId, data.readSince));

	const labelColor = (id: string | null) =>
		data.labels.find((l) => l.id === id)?.color ?? '#9AA3A0';
	const calendarName = (id: string) => data.calendars.find((c) => c.id === id)?.name ?? '';
	const memberIsMe = (id: string | null) => !!id && data.members.some((m) => m.id === id && m.isMe);

	// Quick add
	const addCalendars = $derived(
		data.calendar ? [data.calendar] : data.calendars.filter((c) => c.me.visible)
	);
	let addTo = $state('');
	const target = $derived(
		addCalendars.some((c) => c.id === addTo) ? addTo : (addCalendars[0]?.id ?? '')
	);
	let title = $state('');
	let adding = $state(false);
	async function add() {
		const t = title.trim();
		if (!t || !target) return;
		adding = true;
		try {
			await api('/api/memos', 'POST', { calendarId: target, title: t });
			title = '';
			await invalidate('app:memos');
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			adding = false;
		}
	}

	// Reordering works within one calendar
	let order = $derived(data.memos.map((m) => m.id));
	const ordered = $derived(order.map((id) => data.memos.find((m) => m.id === id)!).filter(Boolean));
	async function reorder(ids: string[]) {
		if (!data.calendar) return;
		order = ids;
		try {
			await api('/api/memos/order', 'PUT', { calendarId: data.calendar.id, ids });
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}
</script>

<svelte:head><title>Memos</title></svelte:head>

<header class="pt-safe sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
	<div class="flex h-13 items-center px-2">
		<ScopeSwitcher calendars={data.calendars} scopeId={data.scopeId} base="/memos" title="Memo" />
	</div>
</header>

<main class="mx-auto max-w-xl pb-8">
	<form
		class="mx-3 mt-3 flex items-center gap-2 rounded-2xl border border-border bg-surface p-1.5 pl-3"
		onsubmit={(e) => {
			e.preventDefault();
			add();
		}}
	>
		<input
			class="min-w-0 flex-1 border-0 bg-transparent p-0 py-1.5 focus:ring-0"
			placeholder="What do you need to do?"
			maxlength="100"
			bind:value={title}
		/>
		{#if addCalendars.length > 1}
			<select
				class="max-w-28 rounded-lg border-border bg-surface py-1 text-xs"
				value={target}
				onchange={(e) => (addTo = e.currentTarget.value)}
				aria-label="Calendar"
			>
				{#each addCalendars as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
			</select>
		{/if}
		<button
			class="icon-btn size-9 shrink-0 bg-accent text-on-accent disabled:opacity-40"
			disabled={adding || !title.trim()}
			aria-label="Add memo"><Plus size={20} /></button
		>
	</form>
	<p class="px-4 pt-2 text-xs text-muted">
		Memos are things without a date yet: shopping lists, ideas, plans. Give one a date later to turn
		it into an event.
	</p>

	{#if !data.memos.length}
		<p class="px-6 py-14 text-center text-sm text-muted">No memos yet.</p>
	{:else}
		<ul
			class="mt-4 divide-y divide-border border-y border-border bg-surface"
			use:sortable={reorder}
		>
			{#each ordered as memo (memo.id)}
				{@const done = memo.checklist.filter((c) => c.done).length}
				{@const isNew =
					memo.updatedAt > (readSince[memo.calendarId] ?? 0) && !memberIsMe(memo.createdByMemberId)}
				<li data-sort-id={memo.id} class="flex items-stretch bg-surface">
					<span class="w-1.5 shrink-0" style:background={labelColor(memo.labelId)}></span>
					<a href="/memos/{memo.id}" class="min-w-0 flex-1 px-3 py-3">
						<p class="flex items-center gap-1.5 font-medium">
							{#if isNew}<span class="size-2 shrink-0 rounded-full bg-accent" aria-label="New"
								></span>{/if}
							<span class="truncate">{memo.title}</span>
						</p>
						<p class="mt-0.5 flex items-center gap-2 text-xs text-muted">
							{#if memo.checklist.length}<span class="flex items-center gap-0.5"
									><ListChecks size={12} />{done}/{memo.checklist.length}</span
								>{/if}
							{#if memo.files.length}<span class="flex items-center gap-0.5"
									><Paperclip size={12} />{memo.files.length}</span
								>{/if}
							{#if memo.note}<span class="truncate">{memo.note.split('\n')[0]}</span>{/if}
							{#if !data.calendar}<span class="truncate">{calendarName(memo.calendarId)}</span>{/if}
						</p>
					</a>
					{#if data.calendar}
						<button data-sort-handle class="touch-none px-3 text-muted" aria-label="Drag to reorder"
							><GripVertical size={18} /></button
						>
					{/if}
				</li>
			{/each}
		</ul>
		{#if data.calendar}<p class="px-4 pt-2 text-xs text-muted">
				Drag the handle to change the order everyone sees.
			</p>{/if}
	{/if}
</main>
