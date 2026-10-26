<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { formatDistanceToNow } from 'date-fns';
	import { SvelteSet } from 'svelte/reactivity';
	import QRCode from 'qrcode';
	import Bell from '@lucide/svelte/icons/bell';
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import Clock from '@lucide/svelte/icons/clock';
	import Copy from '@lucide/svelte/icons/copy';
	import CopyPlus from '@lucide/svelte/icons/copy-plus';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Globe from '@lucide/svelte/icons/globe';
	import History from '@lucide/svelte/icons/history';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import Link from '@lucide/svelte/icons/link';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Pin from '@lucide/svelte/icons/pin';
	import PinOff from '@lucide/svelte/icons/pin-off';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Share2 from '@lucide/svelte/icons/share-2';
	import StickyNote from '@lucide/svelte/icons/sticky-note';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Users from '@lucide/svelte/icons/users';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import ReactionBar from '#lib/components/ReactionBar.svelte';
	import CommentsThread from '#lib/components/event/CommentsThread.svelte';
	import { api } from '#lib/api.js';
	import { formatEventWhen, fileSize, mapsUrl } from '#lib/event-format.js';
	import { dayCountText, isPinned } from '#lib/event-utils.js';
	import { alertLabel, VIRTUAL_PRESETS } from '#lib/meta.js';
	import { colorName, textOn } from '#lib/palette.js';
	import { describeRepeat, isRecurring, occurrenceDay } from '#lib/recurrence.js';
	import { toast } from '#lib/toast.svelte.js';
	import { todayKey } from '#lib/dates.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import MiniCalendar from '#lib/components/calendar/MiniCalendar.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const e = $derived(data.event);
	const at = $derived(data.occurrenceStartAt);
	const atQuery = $derived(at != null ? `?at=${at}` : '');
	const repeating = $derived(isRecurring(e));
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
	const day = $derived(occurrenceDay(e, data.tz));
	const today = $derived(todayKey(data.tz));
	const pinned = $derived(isPinned(e, at));
	const doneCount = $derived(e.checklist.filter((c) => c.done).length);
	const seriesStartDay = $derived(
		data.seriesStartAt != null ? occurrenceDay({ ...e, startAt: data.seriesStartAt }, data.tz) : day
	);

	const FIELD_NAMES: Record<string, string> = {
		title: 'title',
		date: 'date',
		repeat: 'repeat',
		location: 'location',
		url: 'URL',
		note: 'note',
		label: 'label',
		attendees: 'members',
		alerts: 'reminders',
		checklist: 'to-do list',
		files: 'attachments',
		day_count: 'day counter'
	};
	function describe(h: (typeof data.history)[number]) {
		const who = (h.actorMemberId && memberById.get(h.actorMemberId)?.name) || 'Someone';
		if (h.type === 'event_created')
			return h.data.copiedFrom ? `${who} created the event as a copy` : `${who} created the event`;
		if (h.type === 'event_deleted')
			return `${who} deleted ${h.data.scope === 'this' ? 'one occurrence' : h.data.scope === 'future' ? 'later occurrences' : 'the event'}`;
		if (h.data.item) return `${who} ${h.data.done ? 'ticked' : 'unticked'} "${h.data.item}"`;
		const fields = ((h.data.fields as string[]) ?? []).map((f) => FIELD_NAMES[f] ?? f);
		return fields.length ? `${who} updated the ${fields.join(', ')}` : `${who} updated the event`;
	}

	// ---- checklist ----
	let toggling = $state<string | null>(null);
	async function toggleItem(id: string, done: boolean) {
		toggling = id;
		try {
			await api(`/api/events/${e.id}/checklist/${id}`, 'PATCH', { done });
			await invalidate('app:event');
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			toggling = null;
		}
	}

	// ---- sheets ----
	let sheet = $state<'more' | 'delete' | 'pin' | 'copyCalendar' | 'copyDates' | 'qr' | null>(null);
	const close = () => (sheet = null);
	const backToCalendar = () => {
		const month = day.slice(0, 7);
		goto(`/c/${document.cookie.includes('lastCal=all') ? 'all' : e.calendarId}?month=${month}`, {
			replace: true,
			refreshAll: true
		});
	};

	async function remove(scope: 'this' | 'future' | 'all') {
		close();
		try {
			await api(`/api/events/${e.id}?scope=${scope}${at != null ? `&at=${at}` : ''}`, 'DELETE');
			toast('Event deleted');
			backToCalendar();
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}
	function askDelete() {
		if (repeating) return void (sheet = 'delete');
		const message =
			data.members.length > 1
				? 'If you delete this event, other members will no longer see it either. Delete it?'
				: 'Are you sure you want to delete this event?';
		if (confirm(message)) remove('all');
	}

	async function pin(next: boolean, scope: 'this' | 'all') {
		close();
		try {
			await api(`/api/events/${e.id}/pin`, 'POST', {
				pinned: next,
				occurrenceStartAt: scope === 'this' ? at : null
			});
			await invalidate('app:event');
			toast(next ? 'Pinned to the top of the day' : 'Pin removed');
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}
	function askPin() {
		if (repeating && !(pinned && e.pinnedAt)) return void (sheet = 'pin');
		pin(!pinned, 'all');
	}

	async function copyTo(calendarId: string) {
		close();
		try {
			const res = await api<{ ids: string[]; calendarId: string }>(
				`/api/events/${e.id}/copy`,
				'POST',
				{ calendarId, occurrenceStartAt: at }
			);
			toast(`Copied to ${data.calendars.find((c) => c.id === calendarId)?.name ?? 'calendar'}`);
			goto(`/events/${res.ids[0]}`);
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}

	let copyMonth = $state('');
	const copyDates = new SvelteSet<string>();
	function openCopyDates() {
		copyMonth = day.slice(0, 7);
		copyDates.clear();
		sheet = 'copyDates';
	}
	function toggleCopyDate(d: string) {
		if (copyDates.has(d)) copyDates.delete(d);
		else if (copyDates.size < 31) copyDates.add(d);
		else toast('Up to 31 dates at once.', 'error');
	}
	async function copyToDates() {
		const dates = [...copyDates].sort();
		close();
		try {
			await api(`/api/events/${e.id}/copy`, 'POST', { dates, occurrenceStartAt: at });
			toast(`Copied to ${dates.length} date${dates.length > 1 ? 's' : ''}`);
			backToCalendar();
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}

	let qrDataUrl = $state('');
	async function showQr() {
		qrDataUrl = await QRCode.toDataURL(`${page.url.origin}/events/${e.id}${atQuery}`, {
			width: 640,
			margin: 2
		});
		sheet = 'qr';
	}

	async function share() {
		const lines = [e.title, `Date and time: ${formatEventWhen(e, data.tz)}`];
		if (repeating) lines.push(`Repeat: ${describeRepeat(e.recurrence, seriesStartDay)}`);
		if (e.locationName) lines.push(`Location: ${e.locationName}`);
		if (e.url) lines.push(`URL: ${e.url}`);
		if (attendees.length) lines.push(`Members: ${attendees.map((a) => a.name).join(', ')}`);
		if (e.checklist.length)
			lines.push('', ...e.checklist.map((c) => `- [${c.done ? 'x' : ' '}] ${c.text}`));
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

	const otherCalendars = $derived(data.calendars.filter((c) => c.id !== e.calendarId));

	// ---- likes, reactions, comments ----
	const nameOf = (id: string) => memberById.get(id)?.name ?? 'A former member';
	async function react(targetType: 'event' | 'comment', targetId: string, emoji: string) {
		try {
			await api('/api/reactions', 'POST', { targetType, targetId, emoji });
			await invalidate('app:event');
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}

	const isOwner = $derived(data.calendar.me.role === 'owner');

	async function saveAsMemo() {
		close();
		const message = repeating
			? 'Save as memo? The date and every repeat of this event will be removed.'
			: 'Save as memo? The date will be removed.';
		if (!confirm(message)) return;
		try {
			await api(`/api/events/${e.id}/to-memo`, 'POST');
			toast('Saved as memo');
			goto(`/memos/${e.id}`, { replace: true });
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}

	async function discussInChat() {
		close();
		try {
			await api(`/api/calendars/${e.calendarId}/chat`, 'POST', { eventId: e.id });
			goto(`/c/${e.calendarId}/chat`);
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}
</script>

<svelte:head><title>{e.title}</title></svelte:head>

<PageHeader title={data.calendar.name} back={() => history.back()}>
	{#snippet actions()}
		<button
			class={['icon-btn', pinned && 'text-accent']}
			onclick={askPin}
			aria-label={pinned ? 'Unpin event' : 'Pin event'}
		>
			{#if pinned}<Pin size={20} fill="currentColor" />{:else}<Pin size={20} />{/if}
		</button>
		<button class="icon-btn" onclick={share} aria-label="Share event"><Share2 size={20} /></button>
		<a class="icon-btn" href="/events/{e.id}/edit{atQuery}" aria-label="Edit event"
			><Pencil size={20} /></a
		>
		<button class="icon-btn" onclick={() => (sheet = 'more')} aria-label="More actions"
			><Ellipsis size={20} /></button
		>
	{/snippet}
</PageHeader>

<main class="mx-auto max-w-xl pb-40">
	<div class="px-5 pt-5 pb-4" style:background="color-mix(in srgb, {color} 16%, var(--surface))">
		{#if label}
			<span
				class="mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
				style:background={color}
				style:color={textOn(color)}
			>
				{label.name || colorName(color)}
			</span>
		{/if}
		<h1 class="text-2xl font-bold break-words">{e.title}</h1>
		{#if e.dayCount}
			<p class="mt-2 flex items-center gap-1.5 text-sm font-semibold text-accent">
				<Hourglass size={16} />
				{dayCountText(e.dayCount, day, today)}
			</p>
		{/if}
		<div class="mt-3">
			<ReactionBar
				reactions={data.reactions}
				showLike
				{nameOf}
				ontoggle={(emoji) => react('event', e.id, emoji)}
			/>
		</div>
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
		{#if repeating}
			<div class="list-row">
				<Repeat size={20} class="shrink-0 text-muted" />
				<span class="flex-1">{describeRepeat(e.recurrence, seriesStartDay)}</span>
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

	{#if e.checklist.length}
		<p class="section-title flex items-center gap-1.5">
			<ListChecks size={14} /> To-do list · {doneCount}/{e.checklist.length} completed
		</p>
		<div class="divide-y divide-border border-y border-border bg-surface">
			{#each e.checklist as item (item.id)}
				<label class="flex items-center gap-3 px-4 py-2.5">
					<input
						type="checkbox"
						class="size-5 rounded text-accent"
						checked={item.done}
						disabled={toggling === item.id}
						onchange={(ev) => toggleItem(item.id, ev.currentTarget.checked)}
					/>
					<span class={['flex-1', item.done && 'text-muted line-through']}>{item.text}</span>
					{#if item.done && item.doneByMemberId && memberById.get(item.doneByMemberId)}
						<Avatar
							name={memberById.get(item.doneByMemberId)!.name}
							fileId={memberById.get(item.doneByMemberId)!.avatarFileId}
							size={20}
						/>
					{/if}
				</label>
			{/each}
		</div>
	{/if}

	{#if e.files.length}
		<p class="section-title flex items-center gap-1.5">
			<Paperclip size={14} />
			{e.files.length} attachment{e.files.length > 1 ? 's' : ''}
		</p>
		<div class="divide-y divide-border border-y border-border bg-surface">
			{#each e.files as f (f.id)}
				<a
					class="flex items-center gap-3 px-4 py-2.5"
					href="/files/{f.id}"
					target="_blank"
					rel="noopener"
				>
					{#if f.mime.startsWith('image/') && f.mime !== 'image/heic'}
						<img src="/files/{f.id}" alt="" class="size-10 rounded-lg object-cover" />
					{:else}
						<span
							class="flex size-10 items-center justify-center rounded-lg bg-surface-2 text-[10px] font-bold text-muted uppercase"
							>{f.name.split('.').pop()}</span
						>
					{/if}
					<span class="min-w-0 flex-1 truncate text-accent">{f.name}</span>
					<span class="text-xs text-muted">{fileSize(f.size)}</span>
				</a>
			{/each}
		</div>
	{/if}

	<CommentsThread
		eventId={e.id}
		calendarId={e.calendarId}
		comments={data.comments}
		members={data.members}
		{isOwner}
	/>

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

	<button class="list-row mt-8 border-y border-border bg-surface text-danger" onclick={askDelete}
		><Trash2 size={20} /> Delete event</button
	>
</main>

<Sheet open={sheet === 'more'} onclose={close}>
	<div class="divide-y divide-border">
		<button class="list-row" onclick={askPin}>
			{#if pinned}<PinOff size={20} class="text-muted" /> Remove pin{:else}<Pin
					size={20}
					class="text-muted"
				/> Pin to the top of the day{/if}
		</button>
		{#if data.calendar.chatEnabled}
			<button class="list-row" onclick={discussInChat}
				><MessageCircle size={20} class="text-muted" /> Discuss in calendar chat</button
			>
		{/if}
		<button class="list-row" onclick={saveAsMemo}
			><NotebookPen size={20} class="text-muted" /> Save as memo</button
		>
		<button class="list-row" onclick={openCopyDates}
			><CopyPlus size={20} class="text-muted" /> Copy to multiple dates</button
		>
		{#if otherCalendars.length}
			<button class="list-row" onclick={() => (sheet = 'copyCalendar')}
				><Copy size={20} class="text-muted" /> Copy to another calendar</button
			>
		{/if}
		<a class="list-row" href="/events/new?calendar={e.calendarId}&date={day}"
			><CalendarPlus size={20} class="text-muted" /> Create new event</a
		>
		<button class="list-row" onclick={showQr}
			><QrCode size={20} class="text-muted" /> Share via QR code</button
		>
		<button
			class="list-row text-danger"
			onclick={() => {
				close();
				askDelete();
			}}><Trash2 size={20} /> Delete</button
		>
	</div>
</Sheet>

<Sheet open={sheet === 'delete'} onclose={close} title="This is a repeating event">
	<p class="px-5 pb-3 text-sm text-muted">Which events should be deleted?</p>
	<div class="divide-y divide-border border-t border-border">
		<button class="list-row text-danger" onclick={() => remove('this')}
			>Delete only this event</button
		>
		<button class="list-row text-danger" onclick={() => remove('future')}
			>Delete this and future events</button
		>
		<button class="list-row text-danger" onclick={() => remove('all')}>Delete all events</button>
	</div>
</Sheet>

<Sheet open={sheet === 'pin'} onclose={close} title={pinned ? 'Remove pin' : 'Pin event'}>
	<div class="divide-y divide-border border-t border-border">
		<button class="list-row" onclick={() => pin(!pinned, 'this')}
			>{pinned ? 'Remove pin only from this event' : 'Pin this event'}</button
		>
		<button class="list-row" onclick={() => pin(!pinned, 'all')}
			>{pinned ? 'Remove pin from all repeating events' : 'Pin all repeating events'}</button
		>
	</div>
</Sheet>

<Sheet
	open={sheet === 'copyCalendar'}
	onclose={close}
	title="Which calendar do you want to copy this event to?"
>
	<div class="divide-y divide-border border-t border-border">
		{#each otherCalendars as c (c.id)}
			<button class="list-row" onclick={() => copyTo(c.id)}>{c.name}</button>
		{/each}
	</div>
	<p class="px-5 py-3 text-xs text-muted">
		The copy won't repeat, and attachments stay with the original.
	</p>
</Sheet>

<Sheet open={sheet === 'copyDates'} onclose={close} title="Copy to multiple dates">
	<div class="px-4 pb-2">
		<MiniCalendar
			bind:month={copyMonth}
			selected={copyDates}
			{today}
			marked={[day]}
			weekStart={data.user?.settings.weekStart ?? 0}
			ontoggle={toggleCopyDate}
		/>
		<p class="pt-2 text-center text-xs text-muted">
			Tap dates to select them (up to 31). Selected: {copyDates.size}
		</p>
	</div>
	{#snippet footer()}
		<button class="btn btn-primary w-full" disabled={!copyDates.size} onclick={copyToDates}
			>Copy event to the selected dates</button
		>
	{/snippet}
</Sheet>

<Sheet open={sheet === 'qr'} onclose={close} title="Share the event via QR code">
	<div class="flex flex-col items-center px-6 pb-6">
		<img src={qrDataUrl} alt="QR code linking to this event" class="w-60 rounded-xl bg-white p-2" />
		<p class="mt-3 text-center text-sm text-muted">
			Members of this calendar can scan it to open the event.
		</p>
	</div>
</Sheet>
