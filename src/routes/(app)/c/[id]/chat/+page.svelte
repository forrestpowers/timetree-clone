<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { format } from 'date-fns';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ClipboardCopy from '@lucide/svelte/icons/clipboard-copy';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import SendHorizontal from '@lucide/svelte/icons/send-horizontal';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { api } from '#lib/api.js';
	import { describeActivity, dayLabel } from '#lib/activity-text.js';
	import { addDaysToKey, dayKey, formatDayKey, todayKey } from '#lib/dates.js';
	import { formatEventWhen } from '#lib/event-format.js';
	import { toast } from '#lib/toast.svelte.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import ReactionBar from '#lib/components/ReactionBar.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import type { ClientActivity, ClientChatMessage } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const memberById = $derived(new Map(data.members.map((m) => [m.id, m])));
	const myId = $derived(data.calendar.me.memberId);
	const nameOf = (id: string) => memberById.get(id)?.name ?? 'A former member';
	const today = $derived(todayKey(data.tz));
	const yesterday = $derived(addDaysToKey(today, -1));

	type Row =
		| { kind: 'day'; key: string; label: string }
		| { kind: 'unread'; key: string }
		| { kind: 'message'; key: string; m: ClientChatMessage; first: boolean }
		| { kind: 'digest'; key: string; items: ClientActivity[] };

	// Messages and calendar updates in time order; updates between two messages become one card
	const rows = $derived.by(() => {
		const timeline = [
			...data.messages.map((m) => ({ at: m.createdAt, m })),
			...data.updates.map((a) => ({ at: a.createdAt, a }))
		].sort((x, y) => x.at - y.at);
		const out: Row[] = [];
		let lastDay = '';
		let unreadShown = !!data.before;
		let prevSender: string | null = null;
		for (const t of timeline) {
			const d = dayKey(t.at, data.tz);
			if (d !== lastDay) {
				out.push({
					kind: 'day',
					key: `day:${d}`,
					label: dayLabel(d, today, yesterday, (k) => formatDayKey(k, 'EEEE, MMMM d'))
				});
				lastDay = d;
				prevSender = null;
			}
			if ('m' in t && t.m) {
				if (!unreadShown && t.at > data.readSince && t.m.memberId !== myId) {
					out.push({ kind: 'unread', key: 'unread' });
					unreadShown = true;
				}
				out.push({ kind: 'message', key: t.m.id, m: t.m, first: prevSender !== t.m.memberId });
				prevSender = t.m.memberId;
			} else if ('a' in t && t.a) {
				const last = out.at(-1);
				if (last?.kind === 'digest') last.items.push(t.a);
				else out.push({ kind: 'digest', key: `digest:${t.a.id}`, items: [t.a] });
				prevSender = null;
			}
		}
		return out;
	});

	let scroller: HTMLElement;
	async function toBottom(smooth = false) {
		await tick();
		scroller?.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
	}
	onMount(() => {
		toBottom();
		invalidate('app:unread');
	});
	// Follow new messages when already near the bottom
	let lastCount = 0;
	$effect(() => {
		const n = data.messages.length;
		if (n !== lastCount) {
			const near =
				scroller && scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 200;
			if (lastCount === 0 || near) toBottom(lastCount !== 0);
			lastCount = n;
		}
	});

	let draft = $state('');
	let sending = $state(false);
	async function send() {
		const body = draft.trim();
		if (!body) return;
		sending = true;
		try {
			await api(`/api/calendars/${data.calendar.id}/chat`, 'POST', { body });
			draft = '';
			await invalidate('app:chat');
			toBottom(true);
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			sending = false;
		}
	}

	async function react(m: ClientChatMessage, emoji: string) {
		try {
			await api('/api/reactions', 'POST', { targetType: 'chat', targetId: m.id, emoji });
			await invalidate('app:chat');
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}

	let selected = $state<ClientChatMessage | null>(null);
	async function copyText() {
		if (!selected) return;
		await navigator.clipboard.writeText(selected.body);
		selected = null;
		toast('Copied');
	}
	async function saveAsMemo() {
		if (!selected) return;
		const text = selected.body;
		selected = null;
		try {
			const firstLine = text.split('\n')[0].slice(0, 100);
			await api('/api/memos', 'POST', {
				calendarId: data.calendar.id,
				title: firstLine,
				note: text.length > firstLine.length ? text : ''
			});
			toast('Saved as memo');
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}
	async function remove() {
		if (!selected) return;
		const m = selected;
		selected = null;
		if (!confirm('Delete this message?')) return;
		try {
			await api(`/api/calendars/${data.calendar.id}/chat/${m.id}`, 'DELETE');
			await invalidate('app:chat');
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}

	let expanded = $state<Record<string, boolean>>({});
	const digestTitle = (items: ClientActivity[]) => {
		const noun = items.every((i) => i.type.startsWith('memo'))
			? 'memo'
			: items.every((i) => i.type.startsWith('event'))
				? 'event'
				: 'item';
		const deleted = items.every((i) => i.type.endsWith('deleted'));
		const n = new Set(items.map((i) => i.eventId)).size;
		return `${n} ${noun}${n > 1 ? 's' : ''} ${deleted ? 'deleted' : 'updated'}`;
	};
</script>

<svelte:head><title>Chat · {data.calendar.name}</title></svelte:head>

<div class="flex h-dvh flex-col">
	<PageHeader title="{data.calendar.name} chat" back="/c/{data.calendar.id}">
		{#snippet actions()}
			<div class="flex -space-x-1.5">
				{#each data.members.slice(0, 4) as m (m.id)}<Avatar
						name={m.name}
						fileId={m.avatarFileId}
						size={24}
						ring
					/>{/each}
			</div>
		{/snippet}
	</PageHeader>

	<div bind:this={scroller} class="min-h-0 flex-1 overflow-y-auto px-3 py-2">
		{#if data.hasMore}
			<a
				class="mx-auto mb-2 flex w-fit items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-xs text-muted"
				href="?before={data.messages[0]?.createdAt}"><RefreshCw size={12} /> Older messages</a
			>
		{/if}
		{#if !rows.length}
			<div class="mx-auto mt-16 max-w-xs text-center text-sm text-muted">
				<p class="text-3xl">💬</p>
				<p class="mt-2">Chat with everyone in this calendar. Event updates appear here too.</p>
			</div>
		{/if}
		{#each rows as row (row.key)}
			{#if row.kind === 'day'}
				<p class="my-3 text-center text-[11px] font-medium text-muted">{row.label}</p>
			{:else if row.kind === 'unread'}
				<p class="my-3 flex items-center gap-2 text-[11px] font-semibold text-accent">
					<span class="h-px flex-1 bg-accent/40"></span>↓ New messages<span
						class="h-px flex-1 bg-accent/40"
					></span>
				</p>
			{:else if row.kind === 'digest'}
				<div
					class="mx-auto my-2 max-w-sm rounded-2xl border border-border bg-surface px-3 py-2 text-xs"
				>
					<p class="flex items-center gap-1.5 font-semibold">
						<CalendarDays size={14} class="text-accent" />
						{digestTitle(row.items)}
					</p>
					<ul class="mt-1 space-y-0.5 text-muted">
						{#each expanded[row.key] ? row.items : row.items.slice(-3) as a (a.id)}
							<li class="truncate">
								<span class="text-text"
									>{a.actorMemberId ? nameOf(a.actorMemberId) : 'Someone'}</span
								>
								{describeActivity(a, data.tz, nameOf).action}{#if a.event}: {#if !a.event.deleted && a.eventId}<a
											class="text-accent"
											href="/events/{a.eventId}">{a.event.title}</a
										>{:else}<span class="line-through">{a.event.title}</span>{/if}{/if}
							</li>
						{/each}
					</ul>
					{#if row.items.length > 3 && !expanded[row.key]}
						<button
							class="mt-1 flex items-center gap-0.5 text-accent"
							onclick={() => (expanded[row.key] = true)}
							><ChevronDown size={12} /> Show all {row.items.length} changes</button
						>
					{/if}
				</div>
			{:else}
				{@const m = row.m}
				{@const mine = m.memberId === myId}
				{@const author = memberById.get(m.memberId)}
				<div
					class={[
						'flex gap-2',
						mine ? 'justify-end' : 'justify-start',
						row.first ? 'mt-3' : 'mt-1'
					]}
				>
					{#if !mine}
						<div class="w-8 shrink-0">
							{#if row.first}<Avatar
									name={author?.name ?? '?'}
									fileId={author?.avatarFileId}
									size={32}
								/>{/if}
						</div>
					{/if}
					<div class={['flex max-w-[78%] flex-col', mine ? 'items-end' : 'items-start']}>
						{#if row.first && !mine}<p class="mb-0.5 text-xs text-muted">
								{author?.name ?? 'A former member'}
							</p>{/if}
						<div class="flex items-end gap-1.5">
							{#if mine}<span class="text-[10px] text-muted">{format(m.createdAt, 'H:mm')}</span
								>{/if}
							{#if m.deleted}
								<p
									class="rounded-2xl border border-dashed border-border px-3 py-2 text-sm text-muted italic"
								>
									Message deleted
								</p>
							{:else}
								<div class={['flex flex-col gap-1', mine ? 'items-end' : 'items-start']}>
									{#if m.event}
										<a
											href="/events/{m.event.id}"
											class="block min-w-48 rounded-2xl border border-border bg-surface px-3 py-2 text-sm shadow-sm"
										>
											<span class="flex items-center gap-1 text-[11px] text-accent"
												><CalendarDays size={12} /> Event</span
											>
											<span class="block font-semibold">{m.event.title}</span>
											{#if m.event.startAt != null}<span class="block text-xs text-muted"
													>{formatEventWhen(
														{ ...m.event, endAt: m.event.startAt, endTz: m.event.startTz },
														data.tz
													).split(' · ')[0]}</span
												>{/if}
										</a>
									{:else if m.kind === 'event'}
										<span class="text-xs text-muted italic">(The shared event was deleted)</span>
									{/if}
									{#if m.body || !m.event}
										<button
											class={[
												'rounded-2xl px-3 py-2 text-left text-[15px] break-words whitespace-pre-wrap',
												mine
													? 'rounded-br-md bg-accent text-on-accent'
													: 'rounded-bl-md bg-surface shadow-sm'
											]}
											onclick={() => (selected = m)}
										>
											{m.body}
										</button>
									{:else}
										<button class="text-[11px] text-muted" onclick={() => (selected = m)}
											>React</button
										>
									{/if}
								</div>
							{/if}
							{#if !mine}<span class="text-[10px] text-muted">{format(m.createdAt, 'H:mm')}</span
								>{/if}
						</div>
						{#if m.reactions.length}
							<div class="mt-1">
								<ReactionBar
									compact
									reactions={m.reactions}
									{nameOf}
									ontoggle={(emoji) => react(m, emoji)}
								/>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		{/each}
	</div>

	<form
		class="pb-safe border-t border-border bg-surface"
		onsubmit={(e) => {
			e.preventDefault();
			send();
		}}
	>
		<div class="mx-auto flex max-w-xl items-end gap-2 p-2">
			<textarea
				class="field max-h-32 min-h-10 flex-1 resize-none !rounded-2xl !py-2 text-[15px]"
				rows="1"
				placeholder="Message"
				maxlength="2000"
				bind:value={draft}
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
						e.preventDefault();
						send();
					}
				}}></textarea>
			<button
				class="icon-btn shrink-0 bg-accent text-on-accent disabled:opacity-40"
				disabled={sending || !draft.trim()}
				aria-label="Send message"><SendHorizontal size={20} /></button
			>
		</div>
	</form>
</div>

<Sheet open={!!selected} onclose={() => (selected = null)}>
	{#if selected}
		{@const m = selected}
		<div class="flex justify-around px-4 pb-3">
			{#each ['❤️', '👍', '😂', '😮', '😢', '🙏', '🎉'] as emoji (emoji)}
				<button
					class={[
						'rounded-full p-2 text-2xl',
						m.reactions.some((r) => r.emoji === emoji && r.mine) && 'bg-accent-soft'
					]}
					onclick={() => {
						react(m, emoji);
						selected = null;
					}}>{emoji}</button
				>
			{/each}
		</div>
		<div class="divide-y divide-border border-t border-border">
			{#if m.body}
				<button class="list-row" onclick={copyText}
					><ClipboardCopy size={20} class="text-muted" /> Copy</button
				>
				<button class="list-row" onclick={saveAsMemo}
					><NotebookPen size={20} class="text-muted" /> Save as memo</button
				>
			{/if}
			{#if m.memberId === myId || data.calendar.me.role === 'owner'}
				<button class="list-row text-danger" onclick={remove}
					><Trash2 size={20} /> Delete message</button
				>
			{/if}
		</div>
	{/if}
</Sheet>
