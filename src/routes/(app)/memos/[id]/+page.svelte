<script lang="ts">
	import { untrack } from 'svelte';
	import { beforeNavigate, goto, invalidate } from '$app/navigation';
	import { formatDistanceToNow } from 'date-fns';
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import Check from '@lucide/svelte/icons/check';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Link from '@lucide/svelte/icons/link';
	import StickyNote from '@lucide/svelte/icons/sticky-note';
	import Tag from '@lucide/svelte/icons/tag';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { api } from '#lib/api.js';
	import { todayKey } from '#lib/dates.js';
	import { colorName, textOn } from '#lib/palette.js';
	import { toast } from '#lib/toast.svelte.js';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import ReactionBar from '#lib/components/ReactionBar.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Toggle from '#lib/components/Toggle.svelte';
	import AttachmentsEditor from '#lib/components/event/AttachmentsEditor.svelte';
	import ChecklistEditor from '#lib/components/event/ChecklistEditor.svelte';
	import CommentsThread from '#lib/components/event/CommentsThread.svelte';
	import type { EventFile } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const memo = $derived(data.memo);

	// Editable copy; replaced when someone else saves (live update) and we have no unsaved changes
	const snapshotOf = (m: typeof data.memo) => ({
		title: m.title,
		note: m.note,
		url: m.url,
		labelId: m.labelId,
		checklist: m.checklist.map((c) => ({
			id: c.id as string | undefined,
			text: c.text,
			done: c.done
		})),
		files: m.files as EventFile[]
	});
	let form = $state(untrack(() => snapshotOf(data.memo)));
	let base = untrack(() => JSON.stringify(snapshotOf(data.memo)));
	const dirty = $derived(JSON.stringify(form) !== base);
	$effect(() => {
		const fresh = JSON.stringify(snapshotOf(data.memo));
		untrack(() => {
			if (fresh !== base && !dirty) {
				form = snapshotOf(data.memo);
				base = fresh;
			}
		});
	});

	let uploading = $state(0);
	let saving = $state(false);
	async function save() {
		if (!form.title.trim()) return toast('No title entered.', 'error');
		if (uploading) return toast('Please save after the file is uploaded.', 'error');
		saving = true;
		try {
			await api(`/api/memos/${memo.id}`, 'PUT', {
				calendarId: memo.calendarId,
				title: form.title,
				note: form.note,
				url: form.url,
				labelId: form.labelId,
				checklist: form.checklist,
				fileIds: form.files.map((f) => f.id)
			});
			base = JSON.stringify(form);
			await invalidate('app:memos');
			toast('Memo saved');
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			saving = false;
		}
	}

	beforeNavigate(({ cancel, willUnload }) => {
		if (!dirty) return;
		if (willUnload) return cancel();
		if (!confirm('Discard your changes to this memo?')) cancel();
	});

	const label = $derived(data.labels.find((l) => l.id === form.labelId));
	const color = $derived(label?.color ?? '#9aa3a0');
	const memberById = $derived(new Map(data.members.map((m) => [m.id, m])));
	const nameOf = (id: string) => memberById.get(id)?.name ?? 'A former member';
	const creator = $derived(memo.createdByMemberId ? memberById.get(memo.createdByMemberId) : null);

	async function react(emoji: string) {
		try {
			await api('/api/reactions', 'POST', { targetType: 'event', targetId: memo.id, emoji });
			await invalidate('app:event');
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}

	let sheet = $state<'label' | 'schedule' | null>(null);
	let when = $state({ allDay: true, date: '', startTime: '09:00', endTime: '10:00' });
	function openSchedule() {
		when = { allDay: true, date: todayKey(data.tz), startTime: '09:00', endTime: '10:00' };
		sheet = 'schedule';
	}
	async function schedule() {
		if (dirty) await save();
		try {
			await api(`/api/memos/${memo.id}/schedule`, 'POST', { ...when, tz: data.tz });
			sheet = null;
			toast('Added to the calendar');
			base = JSON.stringify(form);
			goto(`/events/${memo.id}`, { replace: true });
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}

	async function remove() {
		if (!confirm('Delete this memo? Other members will no longer see it either.')) return;
		try {
			await api(`/api/memos/${memo.id}`, 'DELETE');
			base = JSON.stringify(form);
			toast('Memo deleted');
			goto(`/memos?c=${memo.calendarId}`, { replace: true });
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}
</script>

<svelte:head><title>{memo.title}</title></svelte:head>

<PageHeader title={data.calendar.name} back="/memos?c={memo.calendarId}">
	{#snippet actions()}
		<button class="btn btn-primary !px-4 !py-1.5" onclick={save} disabled={saving || !dirty}
			>Save</button
		>
	{/snippet}
</PageHeader>

<main class="mx-auto max-w-xl pb-40">
	<div class="px-4 pt-4 pb-3" style:background="color-mix(in srgb, {color} 14%, var(--surface))">
		<input
			class="w-full border-0 bg-transparent p-0 text-2xl font-bold placeholder:text-muted focus:ring-0"
			placeholder="Title"
			maxlength="100"
			bind:value={form.title}
		/>
		<div class="mt-3">
			<ReactionBar reactions={data.reactions} showLike {nameOf} ontoggle={react} />
		</div>
	</div>

	<div class="divide-y divide-border border-y border-border bg-surface">
		<button class="list-row" onclick={() => (sheet = 'label')}>
			<Tag size={20} class="text-muted" />
			<span class="size-5 rounded-full" style:background={color}></span>
			<span class="flex-1 truncate text-left"
				>{label ? label.name || colorName(label.color) : 'No label'}</span
			>
			<ChevronRight size={18} class="text-muted" />
		</button>
		<label class="list-row">
			<Link size={20} class="text-muted" />
			<input
				class="min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0"
				placeholder="URL"
				type="url"
				maxlength="2000"
				bind:value={form.url}
			/>
		</label>
		<label class="list-row items-start">
			<StickyNote size={20} class="mt-0.5 text-muted" />
			<textarea
				class="min-h-20 min-w-0 flex-1 resize-y border-0 bg-transparent p-0 focus:ring-0"
				placeholder="Note"
				maxlength="10000"
				bind:value={form.note}></textarea>
		</label>
		<button class="list-row text-accent" onclick={openSchedule}
			><CalendarPlus size={20} /> Add to calendar (give it a date)</button
		>
	</div>

	<ChecklistEditor bind:items={form.checklist} />
	<AttachmentsEditor bind:files={form.files} bind:uploading calendarId={memo.calendarId} />

	<CommentsThread
		eventId={memo.id}
		calendarId={memo.calendarId}
		comments={data.comments}
		members={data.members}
		isOwner={data.calendar.me.role === 'owner'}
	/>

	<p class="px-4 pt-3 text-xs text-muted">
		{creator ? `Created by ${creator.name} · ` : ''}Created {formatDistanceToNow(memo.createdAt, {
			addSuffix: true
		})}
	</p>
	<button class="list-row mt-6 border-y border-border bg-surface text-danger" onclick={remove}
		><Trash2 size={20} /> Delete memo</button
	>
</main>

<Sheet open={sheet === 'label'} onclose={() => (sheet = null)} title="Label">
	<div class="divide-y divide-border">
		<button
			class="list-row"
			onclick={() => {
				form.labelId = null;
				sheet = null;
			}}
		>
			<span
				class="flex size-7 items-center justify-center rounded-full border border-border"
				style:background="#9aa3a0"
				style:color={textOn('#9aa3a0')}
			>
				{#if !form.labelId}<Check size={16} strokeWidth={3} />{/if}
			</span>
			<span class="flex-1 text-left">No label</span>
		</button>
		{#each data.labels as l (l.id)}
			<button
				class="list-row"
				onclick={() => {
					form.labelId = l.id;
					sheet = null;
				}}
			>
				<span
					class="flex size-7 items-center justify-center rounded-full"
					style:background={l.color}
					style:color={textOn(l.color)}
				>
					{#if l.id === form.labelId}<Check size={16} strokeWidth={3} />{/if}
				</span>
				<span class="flex-1 text-left">{l.name || colorName(l.color)}</span>
			</button>
		{/each}
	</div>
</Sheet>

<Sheet open={sheet === 'schedule'} onclose={() => (sheet = null)} title="Add to calendar">
	<div class="space-y-3 px-4 pb-2">
		<label class="flex items-center gap-3"
			><span class="w-16 text-sm text-muted">Date</span><input
				class="field flex-1 !py-1.5"
				type="date"
				bind:value={when.date}
			/></label
		>
		<div class="flex items-center gap-3">
			<span class="flex-1 text-sm">All-day</span><Toggle
				label="All-day"
				bind:checked={when.allDay}
			/>
		</div>
		{#if !when.allDay}
			<div class="flex items-center gap-2">
				<input class="field !py-1.5" type="time" bind:value={when.startTime} />
				<span class="text-muted">–</span>
				<input class="field !py-1.5" type="time" bind:value={when.endTime} />
			</div>
		{/if}
		<p class="text-xs text-muted">
			The memo becomes an event on that day, keeping its to-do list, notes and comments.
		</p>
	</div>
	{#snippet footer()}<button class="btn btn-primary w-full" disabled={!when.date} onclick={schedule}
			>Add to calendar</button
		>{/snippet}
</Sheet>
