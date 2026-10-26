<script lang="ts">
	import { goto, invalidate, preloadData } from '$app/navigation';
	import { page } from '$app/state';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Settings from '@lucide/svelte/icons/settings';
	import Plus from '@lucide/svelte/icons/plus';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Check from '@lucide/svelte/icons/check';
	import History from '@lucide/svelte/icons/history';
	import {
		DAY_MS,
		dateToUtcMs,
		eventDayRange,
		formatDayKey,
		formatMonth,
		shiftMonth,
		todayKey,
		addDaysToKey
	} from '#lib/dates.js';
	import { api } from '#lib/api.js';
	import { buildItems, daysBetween, eventToInput, type CalendarItem } from '#lib/calendar-items.js';
	import { isRecurring } from '#lib/recurrence.js';
	import { toast } from '#lib/toast.svelte.js';
	import { purposeOf } from '#lib/meta.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import MonthGrid from '#lib/components/calendar/MonthGrid.svelte';
	import EventRow from '#lib/components/calendar/EventRow.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const today = $derived(todayKey(data.tz));
	const calendarById = $derived(new Map(data.calendars.map((c) => [c.id, c])));
	const people = $derived(
		new Map([
			...data.members.map(
				(m) => [m.id, { id: m.id, name: m.name, avatarFileId: m.avatarFileId }] as const
			),
			...data.virtualMembers.map(
				(v) => [v.id, { id: v.id, name: v.name, avatarFileId: v.avatarFileId }] as const
			)
		])
	);
	const calendarMembers = $derived(
		data.calendar ? data.members.filter((m) => m.calendarId === data.calendar!.id) : []
	);

	// Expanded occurrences, birthdays and folded duplicates for the visible grid
	const items = $derived(
		buildItems({
			events: data.events,
			labels: data.labels,
			members: data.members,
			virtualMembers: data.virtualMembers,
			calendars: data.calendar ? [data.calendar] : data.calendars,
			from: dateToUtcMs(data.days[0]) - DAY_MS,
			to: dateToUtcMs(data.days[41]) + 2 * DAY_MS,
			fold: !data.calendar
		})
	);

	// The selected day lives in history state, so Back closes the day sheet
	const selected = $derived((page.state as { day?: string }).day ?? null);
	let sheetOpen = $derived(!!selected);

	function select(day: string) {
		goto(page.url.pathname + page.url.search, { shallow: true, state: { day } });
	}
	function closeDay() {
		if (selected) history.back();
	}
	function stepDay(delta: number) {
		if (!selected) return;
		goto(page.url.pathname + page.url.search, {
			shallow: true,
			replace: true,
			state: { day: addDaysToKey(selected, delta) }
		});
	}

	function monthHref(month: string) {
		const url = new URL(page.url.href);
		url.searchParams.set('month', month);
		return url.pathname + url.search;
	}
	function changeMonth(delta: number) {
		goto(monthHref(shiftMonth(data.month, delta)), { replace: true, reset: false });
	}
	function goToday() {
		goto(monthHref(today.slice(0, 7)), { replace: true, reset: false });
	}
	// Warm the neighbouring months so swiping feels instant
	$effect(() => {
		preloadData(monthHref(shiftMonth(data.month, 1)));
		preloadData(monthHref(shiftMonth(data.month, -1)));
	});

	const dayItems = $derived.by(() => {
		if (!selected) return [];
		// The day list shows every copy, so unfold
		return buildItems({
			events: data.events,
			labels: data.labels,
			members: data.members,
			virtualMembers: data.virtualMembers,
			calendars: data.calendar ? [data.calendar] : data.calendars,
			from: dateToUtcMs(selected) - DAY_MS,
			to: dateToUtcMs(selected) + 2 * DAY_MS,
			fold: false
		})
			.filter((i) => {
				const r = eventDayRange(i, data.tz);
				return r && r[0] <= selected && r[1] >= selected;
			})
			.sort(
				(a, b) =>
					Number(b.pinned) - Number(a.pinned) ||
					Number(!!b.birthday) - Number(!!a.birthday) ||
					Number(b.allDay) - Number(a.allDay) ||
					a.startAt - b.startAt
			);
	});

	// ---- calendar used for quick actions in All Calendars ----
	const actionCalendarId = $derived(
		data.calendar?.id ?? data.calendars.find((c) => c.me.visible)?.id ?? data.calendars[0]?.id
	);
	const myMemberId = (calendarId: string) =>
		data.members.find((m) => m.calendarId === calendarId && m.isMe)?.id ?? null;

	// ---- drag and drop: move or copy to another day ----
	let dropping = $state<{ item: CalendarItem; from: string; to: string } | null>(null);
	async function finishDrop(mode: 'move' | 'copy') {
		const d = dropping;
		dropping = null;
		if (!d?.item.event) return;
		const ev = d.item.event;
		const shift = daysBetween(d.from, d.to);
		try {
			if (mode === 'copy') {
				await api(`/api/events/${ev.id}/copy`, 'POST', {
					dates: [addDaysToKey(eventStartDay(ev), shift)],
					occurrenceStartAt: ev.occurrenceStartAt
				});
				toast('Copy completed');
			} else {
				const repeating = isRecurring(ev) && ev.occurrenceStartAt != null;
				await api(`/api/events/${ev.id}`, 'PUT', {
					...eventToInput(ev, shift),
					// Moving one occurrence detaches it from the series
					scope: repeating ? 'this' : 'all',
					occurrenceStartAt: ev.occurrenceStartAt
				});
				toast(repeating ? 'Moved this occurrence' : 'Event moved');
			}
			await invalidate('app:events');
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}
	const eventStartDay = (ev: CalendarItem['event'] & {}) => eventDayRange(ev, data.tz)?.[0] ?? '';

	// ---- long press on a day: one-tap creation from recent events ----
	type Template = {
		title: string;
		allDay: boolean;
		startTime: string | null;
		endTime: string | null;
		days: number;
		tz: string;
		labelId: string | null;
		uses: number;
	};
	let quickDay = $state<string | null>(null);
	let templates = $state<Template[]>([]);
	let templatesFor = '';
	async function openQuick(day: string) {
		quickDay = day;
		if (actionCalendarId && templatesFor !== actionCalendarId) {
			templatesFor = actionCalendarId;
			templates = await api<Template[]>(
				`/api/events/templates?calendarId=${actionCalendarId}`
			).catch(() => []);
		}
	}
	async function createFromTemplate(t: Template) {
		const day = quickDay!;
		quickDay = null;
		const me = myMemberId(actionCalendarId!);
		try {
			await api('/api/events', 'POST', {
				calendarId: actionCalendarId,
				title: t.title,
				allDay: t.allDay,
				startDate: day,
				endDate: addDaysToKey(day, t.days),
				startTime: t.startTime ?? undefined,
				endTime: t.endTime ?? undefined,
				startTz: t.allDay ? 'UTC' : t.tz,
				endTz: t.allDay ? 'UTC' : t.tz,
				labelId: t.labelId,
				attendees: me ? [{ id: me, type: 'member' }] : []
			});
			toast(`"${t.title}" added on ${formatDayKey(day, 'MMM d')}`);
			templatesFor = '';
			await invalidate('app:events');
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}
	const PRESETS = ['Date', 'Dentist', 'Day off', 'Part-time job', 'Lunch', 'Pickup'];
	const labelColor = (id: string | null) =>
		data.labels.find((l) => l.id === id)?.color ?? '#9AA3A0';

	let switcherOpen = $state(false);
	const title = $derived(data.calendar?.name ?? 'All Calendars');

	const newEventHref = $derived.by(() => {
		const cal =
			data.calendar?.id ?? data.calendars.find((c) => c.me.visible)?.id ?? data.calendars[0]?.id;
		const date = selected ?? (data.month === today.slice(0, 7) ? today : `${data.month}-01`);
		return `/events/new?calendar=${cal}&date=${date}`;
	});

	const background = $derived.by(() => {
		const bg = data.calendar?.background;
		if (!bg || bg.type === 'none') return '';
		if (bg.type === 'color')
			return `background: color-mix(in srgb, ${bg.color} 10%, var(--surface))`;
		return `background: linear-gradient(color-mix(in srgb, var(--surface) 82%, transparent), color-mix(in srgb, var(--surface) 82%, transparent)), url(/files/${bg.fileId}) center/cover`;
	});
</script>

<svelte:head><title>{title}</title></svelte:head>

<div class="flex h-[calc(100dvh-env(safe-area-inset-bottom)-3.5rem)] flex-col">
	<header class="pt-safe shrink-0 border-b border-border bg-surface">
		<div class="flex h-12 items-center gap-1 px-2">
			<button
				class="flex min-w-0 items-center gap-1 rounded-lg px-2 py-1 hover:bg-surface-2"
				onclick={() => (switcherOpen = true)}
			>
				<span class="truncate text-[17px] font-bold">{title}</span>
				<ChevronDown size={18} class="shrink-0 text-muted" />
			</button>
			<div class="flex-1"></div>
			{#if data.calendar}
				<a href="/c/{data.calendar.id}/members" class="mr-1 flex -space-x-1.5" aria-label="Members">
					{#each calendarMembers.slice(0, 4) as m (m.id)}<Avatar
							name={m.name}
							fileId={m.avatarFileId}
							size={24}
							ring
						/>{/each}
				</a>
				{#if calendarMembers.length < 2}
					<a
						class="icon-btn text-accent"
						href="/c/{data.calendar.id}/invite"
						aria-label="Invite members"><UserPlus size={20} /></a
					>
				{/if}
				<a class="icon-btn" href="/c/{data.calendar.id}/settings" aria-label="Calendar settings"
					><Settings size={20} /></a
				>
			{/if}
		</div>
		<div class="flex h-9 items-center px-2">
			<button class="icon-btn size-8" onclick={() => changeMonth(-1)} aria-label="Previous month"
				><ChevronLeft size={20} /></button
			>
			<h2 class="min-w-36 text-center text-[15px] font-semibold">{formatMonth(data.month)}</h2>
			<button class="icon-btn size-8" onclick={() => changeMonth(1)} aria-label="Next month"
				><ChevronRight size={20} /></button
			>
			<div class="flex-1"></div>
			{#if data.month !== today.slice(0, 7)}
				<button
					class="rounded-full border border-border px-3 py-1 text-xs font-semibold"
					onclick={goToday}>Today</button
				>
			{/if}
		</div>
	</header>

	<div class="min-h-0 flex-1 bg-surface" style={background}>
		<MonthGrid
			days={data.days}
			month={data.month}
			{items}
			tz={data.tz}
			{today}
			{selected}
			weekStart={data.weekStart}
			saturdayBlue={data.user?.settings.saturdayBlue ?? true}
			onselect={select}
			onswipe={changeMonth}
			onlongpress={openQuick}
			ondrop={(item, from, to) => (dropping = { item, from, to })}
		/>
	</div>
</div>

<a
	href={newEventHref}
	class="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 flex size-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg active:scale-95"
	aria-label="Create an event"
>
	<Plus size={28} strokeWidth={2.5} />
</a>

<Sheet bind:open={sheetOpen} onclose={closeDay}>
	{#if selected}
		<div class="flex items-center gap-1 px-3 pb-2">
			<button class="icon-btn" onclick={() => stepDay(-1)} aria-label="Previous day"
				><ChevronLeft size={20} /></button
			>
			<h2 class="flex-1 text-center font-semibold">{formatDayKey(selected, 'EEEE, MMMM d')}</h2>
			<button class="icon-btn" onclick={() => stepDay(1)} aria-label="Next day"
				><ChevronRight size={20} /></button
			>
		</div>
		{#if dayItems.length}
			<div class="divide-y divide-border border-t border-border">
				{#each dayItems as item (item.id)}
					<EventRow
						{item}
						day={selected}
						{today}
						tz={data.tz}
						calendarName={data.calendar || !item.event
							? ''
							: (calendarById.get(item.event.calendarId)?.name ?? '')}
						people={(item.event?.attendees ?? []).map((a) => people.get(a.id)).filter((p) => !!p)}
					/>
				{/each}
			</div>
		{:else}
			<p class="px-6 py-10 text-center text-sm text-muted">No events</p>
		{/if}
		<div class="p-3">
			<a
				href="/events/new?calendar={data.calendar?.id ??
					data.calendars.find((c) => c.me.visible)?.id}&date={selected}"
				class="btn btn-secondary w-full"
			>
				<Plus size={18} /> Add event on {formatDayKey(selected, 'MMM d')}
			</a>
		</div>
	{/if}
</Sheet>

<Sheet bind:open={switcherOpen} title="Switch calendar">
	<div class="divide-y divide-border border-t border-border">
		<a href="/c/all" class="list-row" onclick={() => (switcherOpen = false)}>
			<span class="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-lg"
				>🗂️</span
			>
			<span class="flex-1 font-medium">All Calendars</span>
			{#if !data.calendar}<Check size={18} class="text-accent" />{/if}
		</a>
		{#each data.calendars as cal (cal.id)}
			<a href="/c/{cal.id}" class="list-row" onclick={() => (switcherOpen = false)}>
				{#if cal.coverFileId}
					<img src="/files/{cal.coverFileId}" alt="" class="size-9 rounded-xl object-cover" />
				{:else}
					<span class="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-lg"
						>{purposeOf(cal.purpose).emoji}</span
					>
				{/if}
				<span class="min-w-0 flex-1 truncate font-medium">{cal.name}</span>
				{#if data.calendar?.id === cal.id}<Check size={18} class="text-accent" />{/if}
			</a>
		{/each}
		<a href="/calendars/new" class="list-row text-accent"><Plus size={20} /> Create Calendar</a>
	</div>
</Sheet>

<Sheet
	open={!!dropping}
	onclose={() => (dropping = null)}
	title={dropping ? `"${dropping.item.title}" to ${formatDayKey(dropping.to, 'EEE, MMM d')}` : ''}
>
	<div class="divide-y divide-border border-t border-border">
		<button class="list-row" onclick={() => finishDrop('move')}>
			Move{#if dropping?.item.event && isRecurring(dropping.item.event)}<span
					class="text-sm text-muted">(only this occurrence)</span
				>{/if}
		</button>
		<button class="list-row" onclick={() => finishDrop('copy')}>Copy</button>
	</div>
</Sheet>

<Sheet
	open={!!quickDay}
	onclose={() => (quickDay = null)}
	title={quickDay ? formatDayKey(quickDay, 'EEEE, MMMM d') : ''}
>
	{#if quickDay}
		{#if templates.length}
			<p class="section-title flex items-center gap-1.5 !pt-0">
				<History size={14} /> Event history · tap to add
			</p>
			<div class="divide-y divide-border border-y border-border">
				{#each templates as t (t.title + t.startTime + t.days)}
					<button class="list-row" onclick={() => createFromTemplate(t)}>
						<span class="w-1.5 self-stretch rounded-full" style:background={labelColor(t.labelId)}
						></span>
						<span class="min-w-0 flex-1 truncate text-left">{t.title}</span>
						<span class="text-xs text-muted"
							>{t.allDay ? 'All-day' : `${t.startTime}–${t.endTime}`}{t.days
								? `, ${t.days + 1} days`
								: ''}</span
						>
					</button>
				{/each}
			</div>
		{:else}
			<p class="px-5 pb-2 text-sm text-muted">
				Events you create often will show up here for one-tap adding.
			</p>
			<div class="flex flex-wrap gap-2 px-5 pb-3">
				{#each PRESETS as title (title)}
					<a
						class="rounded-full border border-border px-3 py-1.5 text-sm"
						href="/events/new?calendar={actionCalendarId}&date={quickDay}&title={encodeURIComponent(
							title
						)}">{title}</a
					>
				{/each}
			</div>
		{/if}
		<div class="p-3">
			<a
				class="btn btn-primary w-full"
				href="/events/new?calendar={actionCalendarId}&date={quickDay}"
				><Plus size={18} /> Create new event</a
			>
		</div>
	{/if}
</Sheet>
