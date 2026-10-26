<script lang="ts">
	import { goto, invalidate, invalidateAll } from '$app/navigation';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Camera from '@lucide/svelte/icons/camera';
	import Tags from '@lucide/svelte/icons/tags';
	import Users from '@lucide/svelte/icons/users';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Palette from '@lucide/svelte/icons/palette';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { api } from '#lib/api.js';
	import { PURPOSES, purposeOf } from '#lib/meta.js';
	import { LABEL_COLORS } from '#lib/palette.js';
	import { toast } from '#lib/toast.svelte.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import ImageUpload from '#lib/components/ImageUpload.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Toggle from '#lib/components/Toggle.svelte';
	import type { CalendarPurpose } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const cal = $derived(data.calendar);

	let name = $state('');
	let description = $state('');
	let profileName = $state('');
	$effect.pre(() => {
		name = cal.name;
		description = cal.description;
		profileName = data.me.name;
	});
	let purposeOpen = $state(false);
	let backgroundOpen = $state(false);

	async function save(patch: Record<string, unknown>, message = 'Saved') {
		try {
			await api(`/api/calendars/${cal.id}`, 'PATCH', patch);
			await Promise.all([invalidate('app:calendar'), invalidate('app:calendars')]);
			if (message) toast(message);
		} catch (e) {
			toast((e as Error).message, 'error');
		}
	}

	async function saveName() {
		const trimmed = name.trim();
		if (!trimmed) return void (name = cal.name);
		if (trimmed !== cal.name || description !== cal.description)
			await save({ name: trimmed, description });
	}

	async function leave() {
		if (!confirm(`Are you sure you want to leave "${cal.name}"?`)) return;
		await api(`/api/calendars/${cal.id}`, 'POST', { action: 'leave' });
		document.cookie = 'lastCal=all; path=/; max-age=31536000';
		await invalidateAll();
		goto('/calendars');
	}

	async function remove() {
		if (
			!confirm(
				`Delete "${cal.name}"? All events in this calendar will be deleted for every member. This can't be undone.`
			)
		)
			return;
		await api(`/api/calendars/${cal.id}`, 'DELETE');
		document.cookie = 'lastCal=all; path=/; max-age=31536000';
		await invalidateAll();
		goto('/calendars');
	}
</script>

<svelte:head><title>Calendar settings</title></svelte:head>

<PageHeader title="Calendar Settings" back="/c/{cal.id}" />

<main class="mx-auto max-w-xl pb-12">
	<ImageUpload
		kind="cover"
		calendarId={cal.id}
		onuploaded={(id) => save({ coverFileId: id }, 'Cover image updated')}
		class="relative block h-40 w-full overflow-hidden bg-accent-soft"
	>
		{#snippet children({ busy })}
			{#if cal.coverFileId}
				<img src="/files/{cal.coverFileId}" alt="" class="h-full w-full object-cover" />
			{:else}
				<span class="flex h-full items-center justify-center text-6xl"
					>{purposeOf(cal.purpose).emoji}</span
				>
			{/if}
			<span
				class="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white"
			>
				<Camera size={14} />
				{busy ? 'Uploading…' : 'Cover image'}
			</span>
		{/snippet}
	</ImageUpload>

	<p class="section-title">Calendar details</p>
	<div class="divide-y divide-border border-y border-border bg-surface">
		<label class="list-row">
			<span class="w-28 shrink-0 text-muted">Name</span>
			<input
				class="min-w-0 flex-1 border-0 bg-transparent p-0 text-right focus:ring-0"
				maxlength="50"
				bind:value={name}
				onblur={saveName}
			/>
		</label>
		<label class="list-row items-start">
			<span class="w-28 shrink-0 text-muted">Description</span>
			<textarea
				class="min-h-12 min-w-0 flex-1 resize-none border-0 bg-transparent p-0 text-right focus:ring-0"
				maxlength="500"
				rows="2"
				placeholder="Optional"
				bind:value={description}
				onblur={saveName}></textarea>
		</label>
		<button class="list-row" onclick={() => (purposeOpen = true)}>
			<span class="w-28 shrink-0 text-muted">Calendar type</span>
			<span class="flex-1 text-right"
				>{purposeOf(cal.purpose).emoji} {purposeOf(cal.purpose).label}</span
			>
			<ChevronRight size={18} class="text-muted" />
		</button>
		<button class="list-row" onclick={() => (backgroundOpen = true)}>
			<Palette size={20} class="text-muted" />
			<span class="flex-1">Background</span>
			{#if cal.background.type === 'color'}
				<span
					class="size-6 rounded-full border border-border"
					style:background={cal.background.color}
				></span>
			{:else if cal.background.type === 'image'}
				<img src="/files/{cal.background.fileId}" alt="" class="size-6 rounded-md object-cover" />
			{:else}
				<span class="text-sm text-muted">None</span>
			{/if}
			<ChevronRight size={18} class="text-muted" />
		</button>
	</div>

	<p class="section-title">Members</p>
	<div class="divide-y divide-border border-y border-border bg-surface">
		<a class="list-row" href="/c/{cal.id}/members">
			<Users size={20} class="text-muted" />
			<span class="flex-1">Member list</span>
			<span class="text-sm text-muted"
				>{data.memberCount}{data.virtualCount ? ` + ${data.virtualCount}` : ''}</span
			>
			<ChevronRight size={18} class="text-muted" />
		</a>
		<a class="list-row" href="/c/{cal.id}/invite">
			<UserPlus size={20} class="text-muted" />
			<span class="flex-1">Invite people to this calendar</span>
			<ChevronRight size={18} class="text-muted" />
		</a>
		<a class="list-row" href="/c/{cal.id}/labels">
			<Tags size={20} class="text-muted" />
			<span class="flex-1">Label management</span>
			<span class="flex -space-x-1">
				{#each data.labels.slice(0, 6) as l (l.id)}<span
						class="size-3.5 rounded-full ring-2 ring-surface"
						style:background={l.color}
					></span>{/each}
			</span>
			<ChevronRight size={18} class="text-muted" />
		</a>
	</div>

	<p class="section-title">Calendar profile</p>
	<div class="divide-y divide-border border-y border-border bg-surface">
		<div class="list-row">
			<span class="flex-1">
				<span class="block">Use a different profile here</span>
				<span class="text-xs text-muted">A name and photo just for this calendar</span>
			</span>
			<Toggle
				label="Use calendar profile"
				checked={cal.me.useCalendarProfile}
				onchange={(v) => save({ useCalendarProfile: v, profileName: profileName || data.me.name })}
			/>
		</div>
		{#if cal.me.useCalendarProfile}
			<div class="list-row">
				<ImageUpload
					kind="avatar"
					maxSize={512}
					onuploaded={(id) =>
						save(
							{
								useCalendarProfile: true,
								profileAvatarFileId: id,
								profileName: profileName || data.me.name
							},
							'Profile updated'
						)}
				>
					{#snippet children({ busy })}<span class={busy ? 'opacity-50' : ''}
							><Avatar name={data.me.name} fileId={data.me.avatarFileId} size={44} /></span
						>{/snippet}
				</ImageUpload>
				<input
					class="field flex-1"
					maxlength="50"
					bind:value={profileName}
					onblur={() =>
						profileName.trim() &&
						profileName !== data.me.name &&
						save({ useCalendarProfile: true, profileName: profileName.trim() }, 'Profile updated')}
				/>
			</div>
		{/if}
	</div>

	<p class="section-title">Display</p>
	<div class="border-y border-border bg-surface">
		<div class="list-row">
			<span class="flex-1">Show members' birthdays</span>
			<Toggle
				label="Show members' birthdays"
				checked={cal.me.showMemberBirthdays}
				onchange={(v) => save({ showMemberBirthdays: v }, '')}
			/>
		</div>
	</div>

	<div class="mt-8 divide-y divide-border border-y border-border bg-surface">
		<button class="list-row text-danger" onclick={leave}><LogOut size={20} /> Leave calendar</button
		>
		{#if cal.me.role === 'owner'}
			<button class="list-row text-danger" onclick={remove}
				><Trash2 size={20} /> Delete calendar</button
			>
		{/if}
	</div>
</main>

<Sheet bind:open={purposeOpen} title="Calendar type">
	<div class="divide-y divide-border">
		{#each PURPOSES as p (p.id)}
			<button
				class="list-row"
				onclick={() => {
					purposeOpen = false;
					save({ purpose: p.id as CalendarPurpose });
				}}
			>
				<span class="text-xl">{p.emoji}</span>
				<span class="flex-1"
					><span class="block font-medium">{p.label}</span><span class="text-xs text-muted"
						>{p.description}</span
					></span
				>
				{#if p.id === cal.purpose}<span class="text-accent">✓</span>{/if}
			</button>
		{/each}
	</div>
</Sheet>

<Sheet bind:open={backgroundOpen} title="Background">
	<div class="px-4 pb-4">
		<div class="grid grid-cols-6 gap-3">
			<button
				class="flex size-11 items-center justify-center rounded-full border border-border text-xs text-muted"
				onclick={() => {
					backgroundOpen = false;
					save({ background: { type: 'none' } });
				}}>None</button
			>
			{#each LABEL_COLORS as c (c.hex)}
				<button
					class="size-11 rounded-full"
					style:background="{c.hex}33"
					style:border="2px solid {c.hex}"
					aria-label={c.name}
					onclick={() => {
						backgroundOpen = false;
						save({ background: { type: 'color', color: c.hex } });
					}}
				></button>
			{/each}
		</div>
		<ImageUpload
			kind="background"
			calendarId={cal.id}
			onuploaded={(id) => {
				backgroundOpen = false;
				return save({ background: { type: 'image', fileId: id } });
			}}
			class="btn btn-secondary mt-5 w-full"
		>
			{#snippet children({ busy })}{busy ? 'Uploading…' : 'Choose a photo'}{/snippet}
		</ImageUpload>
	</div>
</Sheet>
