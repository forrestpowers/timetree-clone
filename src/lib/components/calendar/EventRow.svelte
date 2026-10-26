<script lang="ts">
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Pin from '@lucide/svelte/icons/pin';
	import Repeat from '@lucide/svelte/icons/repeat';
	import { dayKey, timeOf } from '#lib/dates.js';
	import { dayCountText } from '#lib/event-utils.js';
	import { isRecurring } from '#lib/recurrence.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import type { CalendarItem } from '#lib/calendar-items.js';

	let {
		item,
		day,
		today,
		tz,
		calendarName = '',
		people
	}: {
		item: CalendarItem;
		day: string;
		today: string;
		tz: string;
		calendarName?: string;
		people: { id: string; name: string; avatarFileId: string | null }[];
	} = $props();

	const event = $derived(item.event);

	// For multi-day timed events, show where this day falls in the span
	const times = $derived.by(() => {
		if (item.allDay) return { top: 'All-day', bottom: '' };
		const startDay = dayKey(item.startAt, tz);
		const endDay = dayKey(Math.max(item.startAt, item.endAt - 1), tz);
		const top = startDay === day ? timeOf(item.startAt, tz) : '';
		const bottom = endDay === day ? timeOf(item.endAt, tz) : '';
		if (!top && !bottom) return { top: 'All-day', bottom: '' };
		return { top: top || '…', bottom: bottom || '…' };
	});
	const href = $derived(
		event
			? `/events/${event.id}${event.occurrenceStartAt != null ? `?at=${event.occurrenceStartAt}` : ''}`
			: null
	);
	const done = $derived(event ? event.checklist.filter((c) => c.done).length : 0);
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	class="flex items-stretch gap-3 px-4 py-2.5 active:bg-surface-2"
>
	<div
		class="flex w-11 shrink-0 flex-col justify-center text-right text-xs leading-tight tabular-nums"
	>
		<span class="font-medium">{times.top}</span>
		{#if times.bottom}<span class="text-muted">{times.bottom}</span>{/if}
	</div>
	<div class="w-1 shrink-0 rounded-full" style:background={item.color}></div>
	<div class="min-w-0 flex-1 py-0.5">
		<p class="flex items-center gap-1 font-medium">
			{#if item.pinned}<Pin size={13} class="shrink-0 text-accent" fill="currentColor" />{/if}
			<span class="truncate">
				{#if item.birthday}{item.birthday.name}'s birthday{#if item.birthday.age}<span
							class="font-normal text-muted"
						>
							· turns {item.birthday.age}</span
						>{/if}{:else}{item.title}{/if}
			</span>
		</p>
		{#if event}
			<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
				{#if event.dayCount}<span class="flex items-center gap-0.5 font-medium text-accent"
						><Hourglass size={12} />{dayCountText(event.dayCount, day, today)}</span
					>{/if}
				{#if isRecurring(event)}<Repeat size={12} />{/if}
				{#if event.checklist.length}<span class="flex items-center gap-0.5"
						><ListChecks size={12} />{done}/{event.checklist.length}</span
					>{/if}
				{#if event.files.length}<span class="flex items-center gap-0.5"
						><Paperclip size={12} />{event.files.length}</span
					>{/if}
				{#if event.locationName}<span class="flex min-w-0 items-center gap-0.5 truncate"
						><MapPin size={12} />{event.locationName}</span
					>{/if}
				{#if calendarName}<span class="truncate">{calendarName}</span>{/if}
				{#if item.folded}<span
						>· also in {item.folded} other calendar{item.folded > 1 ? 's' : ''}</span
					>{/if}
			</div>
		{/if}
	</div>
	{#if people.length}
		<div class="flex shrink-0 items-center -space-x-1.5">
			{#each people.slice(0, 3) as p (p.id)}<Avatar
					name={p.name}
					fileId={p.avatarFileId}
					size={22}
					ring
				/>{/each}
			{#if people.length > 3}<span class="pl-2 text-xs text-muted">+{people.length - 3}</span>{/if}
		</div>
	{/if}
</svelte:element>
