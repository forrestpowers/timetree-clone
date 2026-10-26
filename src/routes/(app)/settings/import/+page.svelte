<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { format } from 'date-fns';
	import FileUp from '@lucide/svelte/icons/file-up';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { api } from '#lib/api.js';
	import { toast } from '#lib/toast.svelte.js';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Summary = {
		source: { id: string; name: string; deactivated: boolean };
		labels: { externalId: number; name: string; color: string }[];
		users: { externalId: string; name: string; eventCount: number }[];
		skipped: { deleted: number; birthdays: number; invalid: number };
		stats: {
			events: number;
			memos: number;
			allDay: number;
			withAlerts: number;
			withNotes: number;
			recurring: number;
			first: number | null;
			last: number | null;
		};
		warnings: string[];
	};
	type Result = {
		calendarId: string;
		imported: number;
		alreadyImported: number;
		virtualMembersCreated: number;
		labelsCreated: number;
	};
	type Item = {
		fileName: string;
		file: unknown;
		summary: Summary | null;
		error: string;
		destination: 'new' | 'existing' | 'skip';
		newName: string;
		existingId: string;
		users: Record<string, 'me' | 'virtual' | 'ignore'>;
		virtualNames: Record<string, string>;
		status: 'ready' | 'importing' | 'done' | 'failed';
		result: Result | null;
	};

	let items = $state<Item[]>([]);
	let reading = $state(false);
	let importing = $state(false);

	async function pick(e: Event) {
		const files = [...((e.currentTarget as HTMLInputElement).files ?? [])];
		reading = true;
		const next: Item[] = [];
		for (const f of files) {
			const item: Item = {
				fileName: f.name,
				file: null,
				summary: null,
				error: '',
				destination: 'skip',
				newName: '',
				existingId: data.calendars[0]?.id ?? '',
				users: {},
				virtualNames: {},
				status: 'ready',
				result: null
			};
			try {
				item.file = JSON.parse(await f.text());
			} catch {
				item.error = 'Not a valid JSON file.';
				next.push(item);
				continue;
			}
			// Skip the exporter's helper files (manifest, import guide)
			if (!item.file || typeof item.file !== 'object' || !('events' in item.file)) continue;
			try {
				const summary = await api<Summary>('/api/import/timetree', 'POST', {
					file: item.file,
					dryRun: true
				});
				item.summary = summary;
				item.newName = summary.source.name;
				const hasContent = summary.stats.events + summary.stats.memos > 0;
				item.destination = hasContent ? 'new' : 'skip';
				summary.users.forEach((u, i) => {
					item.users[u.externalId] = i === 0 ? 'me' : 'virtual';
					item.virtualNames[u.externalId] = u.name || `TimeTree member ${i + 1}`;
				});
			} catch (err) {
				item.error = (err as Error).message;
			}
			next.push(item);
		}
		items = next;
		reading = false;
		if (!next.length) toast('No TimeTree calendar files found in that selection.', 'error');
	}

	async function runImport() {
		importing = true;
		for (const item of items) {
			if (!item.summary || item.destination === 'skip' || item.status === 'done') continue;
			item.status = 'importing';
			try {
				item.result = await api<Result>('/api/import/timetree', 'POST', {
					file: item.file,
					target:
						item.destination === 'new'
							? { type: 'new', name: item.newName }
							: { type: 'existing', calendarId: item.existingId },
					users: item.users,
					virtualNames: item.virtualNames
				});
				item.status = 'done';
			} catch (err) {
				item.status = 'failed';
				item.error = (err as Error).message;
			}
		}
		importing = false;
		await invalidateAll();
	}

	const fmtRange = (s: Summary['stats']) =>
		s.first && s.last ? `${format(s.first, 'MMM yyyy')} – ${format(s.last, 'MMM yyyy')}` : '';
	const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

	function details(s: Summary) {
		const parts = [
			`${s.stats.withAlerts.toLocaleString()} with reminders`,
			`${s.stats.withNotes.toLocaleString()} with notes`
		];
		if (s.stats.recurring) parts.push(`${s.stats.recurring.toLocaleString()} repeating`);
		const skipped = [
			s.skipped.deleted && `${s.skipped.deleted.toLocaleString()} deleted`,
			s.skipped.birthdays && plural(s.skipped.birthdays, 'birthday'),
			s.skipped.invalid && `${s.skipped.invalid.toLocaleString()} unreadable`
		].filter(Boolean);
		if (skipped.length) parts.push(`skipping ${skipped.join(', ')}`);
		return parts.join(' · ');
	}

	const pending = $derived(
		items.filter((i) => i.summary && i.destination !== 'skip' && i.status !== 'done').length
	);
</script>

<svelte:head><title>Import from TimeTree</title></svelte:head>

<PageHeader title="Import from TimeTree" back="/more" />

<main class="mx-auto max-w-xl px-4 pt-4 pb-16">
	<p class="text-sm text-muted">
		Select the JSON files from your TimeTree export (one per calendar). You'll see what's in them
		before anything is imported. Importing the same file twice won't create duplicates.
	</p>

	<label class="btn btn-secondary mt-4 flex w-full cursor-pointer">
		<FileUp size={18} />
		{reading ? 'Reading…' : items.length ? 'Choose different files' : 'Choose export files'}
		<input type="file" accept=".json,application/json" multiple class="hidden" onchange={pick} />
	</label>

	{#each items as item (item.fileName)}
		<section class="card mt-5 overflow-hidden">
			<header class="flex items-center gap-2 border-b border-border px-4 py-3">
				<span class="min-w-0 flex-1">
					<span class="block truncate font-semibold"
						>{item.summary?.source.name ?? item.fileName}</span
					>
					<span class="block truncate text-xs text-muted">{item.fileName}</span>
				</span>
				{#if item.status === 'done'}<CircleCheck size={20} class="text-accent" />{/if}
			</header>

			{#if item.error && !item.summary}
				<p class="flex gap-2 p-4 text-sm text-danger">
					<TriangleAlert size={18} class="shrink-0" />{item.error}
				</p>
			{:else if item.summary}
				{@const s = item.summary}
				<div class="space-y-3 p-4 text-sm">
					<p>
						<strong>{plural(s.stats.events, 'event')}</strong>
						{#if s.stats.allDay}({s.stats.allDay.toLocaleString()} all-day){/if}
						{#if s.stats.memos}· <strong>{plural(s.stats.memos, 'memo')}</strong>{/if}
						{#if fmtRange(s.stats)}<span class="text-muted"> · {fmtRange(s.stats)}</span>{/if}
					</p>
					<p class="text-muted">{details(s)}</p>
					{#if s.labels.length}
						<div class="flex flex-wrap items-center gap-1.5">
							<span class="text-muted">Labels:</span>
							{#each s.labels as l (l.externalId)}
								<span
									class="flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pr-2 pl-0.5 text-xs"
								>
									<span class="size-4 rounded-full" style:background={l.color}></span>{l.name ||
										`#${l.externalId}`}
								</span>
							{/each}
						</div>
					{/if}
					{#each s.warnings as w (w)}
						<p class="flex gap-1.5 text-xs text-amber-600">
							<TriangleAlert size={14} class="mt-0.5 shrink-0" />{w}
						</p>
					{/each}
					{#if s.source.deactivated}
						<p class="text-xs text-muted">This calendar was deleted in TimeTree.</p>
					{/if}
				</div>

				{#if item.status === 'done' && item.result}
					<div class="border-t border-border bg-accent-soft p-4 text-sm">
						<p>
							Imported <strong>{plural(item.result.imported, 'item')}</strong
							>{#if item.result.alreadyImported}
								({item.result.alreadyImported.toLocaleString()} were already here){/if}.
						</p>
						<a
							class="mt-2 inline-block font-semibold text-accent"
							href="/c/{item.result.calendarId}">Open calendar →</a
						>
					</div>
				{:else}
					{#if s.users.length}
						<div class="border-t border-border p-4">
							<p class="mb-2 text-sm font-semibold">People in this calendar</p>
							{#each s.users as u, i (u.externalId)}
								<div class="flex flex-wrap items-center gap-2 py-1.5 text-sm">
									<span class="min-w-0 flex-1">
										{u.name || `TimeTree member ${i + 1}`}
										<span class="text-xs text-muted"
											>· attends {u.eventCount.toLocaleString()} events</span
										>
									</span>
									<select
										class="rounded-lg border-border bg-surface py-1 text-sm"
										bind:value={item.users[u.externalId]}
									>
										<option value="me">This is me</option>
										<option value="virtual">Virtual member</option>
										<option value="ignore">Leave out</option>
									</select>
									{#if item.users[u.externalId] === 'virtual'}
										<input
											class="field !py-1.5 text-sm"
											placeholder="Name"
											maxlength="50"
											bind:value={item.virtualNames[u.externalId]}
										/>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					<div class="space-y-2 border-t border-border p-4 text-sm">
						<p class="font-semibold">Import into</p>
						<label class="flex items-center gap-2">
							<input type="radio" value="new" bind:group={item.destination} class="text-accent" /> A new
							calendar
						</label>
						{#if item.destination === 'new'}
							<input
								class="field ml-6 !w-[calc(100%-1.5rem)] !py-1.5"
								maxlength="50"
								bind:value={item.newName}
							/>
						{/if}
						{#if data.calendars.length}
							<label class="flex items-center gap-2">
								<input
									type="radio"
									value="existing"
									bind:group={item.destination}
									class="text-accent"
								/> An existing calendar
							</label>
							{#if item.destination === 'existing'}
								<select
									class="ml-6 rounded-lg border-border bg-surface py-1.5 text-sm"
									bind:value={item.existingId}
								>
									{#each data.calendars as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
								</select>
							{/if}
						{/if}
						<label class="flex items-center gap-2">
							<input type="radio" value="skip" bind:group={item.destination} class="text-accent" /> Don't
							import
						</label>
						{#if item.status === 'failed'}<p class="text-danger">{item.error}</p>{/if}
					</div>
				{/if}
			{/if}
		</section>
	{/each}

	{#if pending}
		<button class="btn btn-primary mt-6 w-full" onclick={runImport} disabled={importing}>
			{importing ? 'Importing…' : `Import ${pending} calendar${pending > 1 ? 's' : ''}`}
		</button>
	{/if}
</main>
