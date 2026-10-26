<script lang="ts">
	import MapPin from '@lucide/svelte/icons/map-pin';
	import { dayKey, timeOf } from '#lib/dates.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import type { ClientEvent } from '#lib/types.js';

	let {
		event,
		day,
		tz,
		color,
		calendarName = '',
		people
	}: {
		event: ClientEvent;
		day: string;
		tz: string;
		color: string;
		calendarName?: string;
		people: { id: string; name: string; avatarFileId: string | null }[];
	} = $props();

	// For multi-day timed events, show where this day falls in the span
	const times = $derived.by(() => {
		if (event.allDay || event.startAt == null) return { top: 'All-day', bottom: '' };
		const startDay = dayKey(event.startAt, tz);
		const endDay = dayKey(Math.max(event.startAt, (event.endAt ?? event.startAt) - 1), tz);
		const top = startDay === day ? timeOf(event.startAt, tz) : '';
		const bottom = endDay === day ? timeOf(event.endAt ?? event.startAt, tz) : '';
		if (!top && !bottom) return { top: 'All-day', bottom: '' };
		return { top: top || '…', bottom: bottom || '…' };
	});
</script>

<a href="/events/{event.id}" class="flex items-stretch gap-3 px-4 py-2.5 active:bg-surface-2">
	<div
		class="flex w-11 shrink-0 flex-col justify-center text-right text-xs leading-tight tabular-nums"
	>
		<span class="font-medium">{times.top}</span>
		{#if times.bottom}<span class="text-muted">{times.bottom}</span>{/if}
	</div>
	<div class="w-1 shrink-0 rounded-full" style:background={color}></div>
	<div class="min-w-0 flex-1 py-0.5">
		<p class="truncate font-medium">{event.title}</p>
		<div class="flex items-center gap-2 text-xs text-muted">
			{#if event.locationName}<span class="flex min-w-0 items-center gap-0.5 truncate"
					><MapPin size={12} />{event.locationName}</span
				>{/if}
			{#if calendarName}<span class="truncate">{calendarName}</span>{/if}
		</div>
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
</a>
