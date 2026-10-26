<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { formatDistanceToNow } from 'date-fns';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { describeActivity, dayLabel } from '#lib/activity-text.js';
	import { addDaysToKey, dayKey, formatDayKey, todayKey } from '#lib/dates.js';
	import { openedReadMarkers } from '#lib/read-markers.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import ScopeSwitcher from '#lib/components/ScopeSwitcher.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The feed was marked read while loading; update the tab badge
	onMount(() => {
		invalidate('app:unread');
	});

	const keepOpened = openedReadMarkers();
	const readSince = $derived(keepOpened(data.scopeId, data.readSince));

	const memberById = $derived(new Map(data.members.map((m) => [m.id, m])));
	const calendarName = (id: string) => data.calendars.find((c) => c.id === id)?.name ?? '';
	const today = $derived(todayKey(data.tz));
	const yesterday = $derived(addDaysToKey(today, -1));

	const groups = $derived.by(() => {
		const out: { label: string; items: typeof data.items }[] = [];
		for (const item of data.items) {
			const isNew = !data.before && item.createdAt > (readSince[item.calendarId] ?? 0);
			const label = isNew
				? 'New'
				: `Changes from ${dayLabel(dayKey(item.createdAt, data.tz), today, yesterday, (k) => formatDayKey(k, 'EEE, MMM d'))}`;
			const last = out.at(-1);
			if (last?.label === label) last.items.push(item);
			else out.push({ label, items: [item] });
		}
		return out;
	});
	const nameOf = (id: string) => memberById.get(id)?.name ?? 'A former member';
	const olderHref = $derived(
		`/activity?c=${data.scopeId}&before=${data.items.at(-1)?.createdAt ?? ''}`
	);
</script>

<svelte:head><title>Activity</title></svelte:head>

<header class="pt-safe sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
	<div class="flex h-13 items-center px-2">
		<ScopeSwitcher
			calendars={data.calendars}
			scopeId={data.scopeId}
			base="/activity"
			title="Activity"
		/>
	</div>
</header>

<main class="mx-auto max-w-xl pb-8">
	{#if !data.items.length}
		<p class="px-6 py-16 text-center text-sm text-muted">
			No recent activity. Changes to events, comments and new members show up here.
		</p>
	{/if}
	{#each groups as group (group.label + group.items[0].id)}
		<p class={['section-title', group.label === 'New' && '!text-accent']}>{group.label}</p>
		<ul class="divide-y divide-border border-y border-border bg-surface">
			{#each group.items as item (item.id)}
				{@const actor = item.actorMemberId ? memberById.get(item.actorMemberId) : null}
				{@const line = describeActivity(item, data.tz, nameOf)}
				{@const href =
					item.eventId && item.event && !item.event.deleted ? `/events/${item.eventId}` : null}
				<li>
					<svelte:element this={href ? 'a' : 'div'} {href} class="flex gap-3 px-4 py-3">
						<Avatar name={actor?.name ?? '?'} fileId={actor?.avatarFileId} size={36} />
						<div class="min-w-0 flex-1 text-sm">
							<p><strong>{actor?.name ?? 'Someone'}</strong> {line.action}</p>
							{#if item.event}
								<p
									class={[
										'mt-0.5 truncate font-medium',
										item.event.deleted && 'text-muted line-through'
									]}
								>
									{item.event.title}
								</p>
							{:else if item.data.title}
								<p class="mt-0.5 truncate font-medium text-muted">{item.data.title}</p>
							{/if}
							{#if line.dates}
								<div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
									<span class="rounded bg-surface-2 px-1.5 py-0.5 text-muted line-through"
										>{line.dates.before}</span
									>
									<ArrowRight size={12} class="text-muted" />
									<span class="rounded bg-accent-soft px-1.5 py-0.5">{line.dates.after}</span>
								</div>
							{/if}
							{#if line.detail}
								<p
									class={[
										'mt-1 text-xs',
										item.type === 'comment'
											? 'line-clamp-3 rounded-lg bg-surface-2 px-2.5 py-1.5 text-text'
											: 'text-muted'
									]}
								>
									{line.detail}
								</p>
							{/if}
							<p class="mt-1 text-xs text-muted">
								{formatDistanceToNow(item.createdAt, { addSuffix: true })}{data.calendar
									? ''
									: ` · ${calendarName(item.calendarId)}`}
							</p>
						</div>
					</svelte:element>
				</li>
			{/each}
		</ul>
	{/each}
	{#if data.hasMore}
		<a class="btn btn-ghost mx-auto mt-4 flex w-fit" href={olderHref}
			><ChevronDown size={18} /> Older activity</a
		>
	{/if}
</main>
