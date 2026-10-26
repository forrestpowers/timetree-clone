<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDistanceToNow } from 'date-fns';
	import Bell from '@lucide/svelte/icons/bell';
	import Clock from '@lucide/svelte/icons/clock';
	import Globe from '@lucide/svelte/icons/globe';
	import Link from '@lucide/svelte/icons/link';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Share2 from '@lucide/svelte/icons/share-2';
	import StickyNote from '@lucide/svelte/icons/sticky-note';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Users from '@lucide/svelte/icons/users';
	import History from '@lucide/svelte/icons/history';
	import { api } from '#lib/api.js';
	import { formatEventWhen, mapsUrl } from '#lib/event-format.js';
	import { alertLabel, VIRTUAL_PRESETS } from '#lib/meta.js';
	import { colorName, textOn } from '#lib/palette.js';
	import { toast } from '#lib/toast.svelte.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { utcMsToDate, dayKey } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const e = $derived(data.event);
	const label = $derived(data.labels.find((l) => l.id === e.labelId));
	const color = $derived(label?.color ?? '#9aa3a0');
	const memberById = $derived(new Map(data.members.map((m) => [m.id, m])));
	const attendees = $derived(
		e.attendees
			.map((a) => {
				if (a.type === 'member') {
					const m = memberById.get(a.id);
					return m && { id: m.id, name: m.name, avatarFileId: m.avatarFileId, emoji: '' };
				}
				const v = data.virtualMembers.find((x) => x.id === a.id);
				return (
					v && {
						id: v.id,
						name: v.name,
						avatarFileId: v.avatarFileId,
						emoji: VIRTUAL_PRESETS.find((p) => p.id === v.preset)?.emoji ?? ''
					}
				);
			})
			.filter((x) => !!x)
	);
	const creator = $derived(e.createdByMemberId ? memberById.get(e.createdByMemberId) : null);
	const otherZone = $derived(!e.allDay && e.startTz !== data.tz);
	const mapApp = $derived(data.user?.settings.mapApp ?? 'google');

	const FIELD_NAMES: Record<string, string> = {
		title: 'title',
		date: 'date',
		location: 'location',
		url: 'URL',
		note: 'note',
		label: 'label',
		attendees: 'members',
		alerts: 'reminders'
	};
	function describe(h: (typeof data.history)[number]) {
		const who = (h.actorMemberId && memberById.get(h.actorMemberId)?.name) || 'Someone';
		if (h.type === 'event_created') return `${who} created the event`;
		if (h.type === 'event_deleted') return `${who} deleted the event`;
		const fields = ((h.data.fields as string[]) ?? []).map((f) => FIELD_NAMES[f] ?? f);
		return fields.length ? `${who} updated the ${fields.join(', ')}` : `${who} updated the event`;
	}

	async function remove() {
		const shared = data.members.length > 1;
		const message = shared
			? 'If you delete this event, other members will no longer see it either. Delete it?'
			: 'Are you sure you want to delete this event?';
		if (!confirm(message)) return;
		try {
			await api(`/api/events/${e.id}`, 'DELETE');
			toast('Event deleted');
			const month = e.allDay
				? utcMsToDate(e.startAt!).slice(0, 7)
				: dayKey(e.startAt!, data.tz).slice(0, 7);
			goto(`/c/${document.cookie.includes('lastCal=all') ? 'all' : e.calendarId}?month=${month}`, {
				replace: true,
				refreshAll: true
			});
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}

	async function share() {
		const lines = [e.title, `Date and time: ${formatEventWhen(e, data.tz)}`];
		if (e.locationName) lines.push(`Location: ${e.locationName}`);
		if (e.url) lines.push(`URL: ${e.url}`);
		if (attendees.length) lines.push(`Members: ${attendees.map((a) => a.name).join(', ')}`);
		if (e.note) lines.push('', e.note);
		const text = lines.join('\n');
		if (typeof navigator.share === 'function') {
			try {
				await navigator.share({ title: e.title, text });
			} catch {
				/* cancelled */
			}
		} else {
			await navigator.clipboard.writeText(text);
			toast('Event copied as text');
		}
	}
</script>

<svelte:head><title>{e.title}</title></svelte:head>

<PageHeader title={data.calendar.name} back={() => history.back()}>
	{#snippet actions()}
		<button class="icon-btn" onclick={share} aria-label="Share event"><Share2 size={20} /></button>
		<a class="icon-btn" href="/events/{e.id}/edit" aria-label="Edit event"><Pencil size={20} /></a>
	{/snippet}
</PageHeader>

<main class="mx-auto max-w-xl pb-16">
	<div class="px-5 pt-5 pb-4" style:background="color-mix(in srgb, {color} 16%, var(--surface))">
		<span
			class="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
			style:background={color}
			style:color={textOn(color)}
		>
			{label?.name || colorName(color)}
		</span>
		<h1 class="mt-2 text-2xl font-bold break-words">{e.title}</h1>
	</div>

	<div class="divide-y divide-border border-y border-border bg-surface">
		<div class="list-row">
			<Clock size={20} class="shrink-0 text-muted" />
			<span class="flex-1">{formatEventWhen(e, data.tz)}</span>
		</div>
		{#if otherZone}
			<div class="list-row text-sm">
				<Globe size={20} class="shrink-0 text-muted" />
				<span class="flex-1"
					>{formatEventWhen(e, e.startTz)}
					<span class="text-muted">({e.startTz.replace(/_/g, ' ')})</span></span
				>
			</div>
		{/if}
		{#if e.alerts.length}
			<div class="list-row">
				<Bell size={20} class="shrink-0 text-muted" />
				<span class="flex-1">{e.alerts.map((m) => alertLabel(m, e.allDay)).join(', ')}</span>
			</div>
		{/if}
		{#if attendees.length}
			<div class="list-row items-start">
				<Users size={20} class="mt-1 shrink-0 text-muted" />
				<div class="flex flex-1 flex-wrap gap-2">
					{#each attendees as a (a.id)}
						<span
							class="flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pr-3 pl-0.5 text-sm"
						>
							{#if a.emoji && !a.avatarFileId}<span class="flex size-6 items-center justify-center"
									>{a.emoji}</span
								>{:else}<Avatar name={a.name} fileId={a.avatarFileId} size={24} />{/if}
							{a.name}
						</span>
					{/each}
				</div>
			</div>
		{/if}
		{#if e.locationName}
			<a class="list-row" href={mapsUrl(e, mapApp)} target="_blank" rel="noopener noreferrer">
				<MapPin size={20} class="shrink-0 text-muted" />
				<span class="flex-1 text-accent">{e.locationName}</span>
			</a>
		{/if}
		{#if e.url}
			<a class="list-row" href={e.url} target="_blank" rel="noopener noreferrer">
				<Link size={20} class="shrink-0 text-muted" />
				<span class="min-w-0 flex-1 truncate text-accent">{e.url}</span>
			</a>
		{/if}
		{#if e.note}
			<div class="list-row items-start">
				<StickyNote size={20} class="mt-0.5 shrink-0 text-muted" />
				<p class="flex-1 break-words whitespace-pre-wrap">{e.note}</p>
			</div>
		{/if}
	</div>

	<p class="px-4 pt-3 text-xs text-muted">
		{creator ? `Created by ${creator.name} · ` : ''}Created {formatDistanceToNow(e.createdAt, {
			addSuffix: true
		})}
		{#if e.updatedAt - e.createdAt > 60_000}
			· Updated {formatDistanceToNow(e.updatedAt, { addSuffix: true })}{/if}
	</p>

	{#if data.history.length > 1}
		<details class="mt-6">
			<summary class="section-title flex cursor-pointer items-center gap-1.5 !normal-case"
				><History size={14} /> Change history</summary
			>
			<ul class="divide-y divide-border border-y border-border bg-surface text-sm">
				{#each data.history as h (h.id)}
					<li class="flex items-center justify-between gap-3 px-4 py-2.5">
						<span>{describe(h)}</span>
						<span class="shrink-0 text-xs text-muted"
							>{formatDistanceToNow(h.createdAt, { addSuffix: true })}</span
						>
					</li>
				{/each}
			</ul>
		</details>
	{/if}

	<button class="list-row mt-8 border-y border-border bg-surface text-danger" onclick={remove}
		><Trash2 size={20} /> Delete event</button
	>
</main>
