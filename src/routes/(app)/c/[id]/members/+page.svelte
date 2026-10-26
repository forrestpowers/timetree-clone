<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { formatDistanceToNow } from 'date-fns';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Plus from '@lucide/svelte/icons/plus';
	import Crown from '@lucide/svelte/icons/crown';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { api } from '#lib/api.js';
	import { MEMBER_ATTRIBUTE_LABELS, VIRTUAL_PRESETS } from '#lib/meta.js';
	import { toast } from '#lib/toast.svelte.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import type { ClientMember } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const me = $derived(data.members.find((m) => m.isMe)!);
	const others = $derived(data.members.filter((m) => !m.isMe));
	const isOwner = $derived(data.calendar.me.role === 'owner');
	let selected = $state<ClientMember | null>(null);
	let sheetOpen = $state(false);

	function open(m: ClientMember) {
		selected = m;
		sheetOpen = true;
	}

	async function kick(m: ClientMember) {
		if (!confirm(`Remove ${m.name}? They will no longer be able to access this calendar.`)) return;
		try {
			await api(`/api/calendars/${data.calendar.id}`, 'POST', { action: 'remove', memberId: m.id });
			sheetOpen = false;
			await invalidate('app:calendar');
			toast(`${m.name} was removed`);
		} catch (e) {
			toast((e as Error).message, 'error');
		}
	}

	const presetEmoji = (p: string) => VIRTUAL_PRESETS.find((v) => v.id === p)?.emoji ?? '👤';

	function birthdayCountdown(birthday: string) {
		const [, m, d] = birthday.split('-').map(Number);
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		let next = new Date(now.getFullYear(), m - 1, d);
		if (next < today) next = new Date(now.getFullYear() + 1, m - 1, d);
		const days = Math.round((next.getTime() - today.getTime()) / 86_400_000);
		return days === 0 ? 'Birthday today 🎂' : `Days until birthday: ${days}`;
	}
</script>

<svelte:head><title>Members</title></svelte:head>

<PageHeader title="Member List" back="/c/{data.calendar.id}/settings" />

<main class="mx-auto max-w-xl pb-28">
	<p class="section-title">Me</p>
	<div class="border-y border-border bg-surface">
		<button class="list-row" onclick={() => open(me)}>
			<Avatar name={me.name} fileId={me.avatarFileId} size={40} />
			<span class="flex-1 font-medium">{me.name}</span>
			{#if me.role === 'owner'}<Crown size={16} class="text-amber-500" />{/if}
		</button>
	</div>

	<p class="section-title">Members ({others.length})</p>
	{#if others.length}
		<div class="divide-y divide-border border-y border-border bg-surface">
			{#each others as m (m.id)}
				<button class="list-row" onclick={() => open(m)}>
					<Avatar name={m.name} fileId={m.avatarFileId} size={40} />
					<span class="min-w-0 flex-1">
						<span class="block truncate font-medium">{m.name}</span>
						{#if m.statusText}<span class="block truncate text-xs text-muted">{m.statusText}</span
							>{/if}
					</span>
					{#if m.role === 'owner'}<Crown size={16} class="text-amber-500" />{/if}
				</button>
			{/each}
		</div>
	{:else}
		<a
			href="/c/{data.calendar.id}/invite"
			class="mx-4 flex items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-sm text-muted"
		>
			<UserPlus size={20} /> No one else yet. Invite people to share this calendar.
		</a>
	{/if}

	<p class="section-title">Virtual members ({data.virtualMembers.length})</p>
	<p class="-mt-1 px-4 pb-2 text-xs text-muted">
		Members without an account, such as children or pets, so you can add them to events.
	</p>
	<div class="divide-y divide-border border-y border-border bg-surface">
		{#each data.virtualMembers as v (v.id)}
			<a class="list-row" href="/c/{data.calendar.id}/members/virtual/{v.id}">
				{#if v.avatarFileId}
					<Avatar name={v.name} fileId={v.avatarFileId} size={40} />
				{:else}
					<span class="flex size-10 items-center justify-center rounded-full bg-surface-2 text-xl"
						>{presetEmoji(v.preset)}</span
					>
				{/if}
				<span class="flex-1 font-medium">{v.name}</span>
				<ChevronRight size={18} class="text-muted" />
			</a>
		{/each}
		<a class="list-row text-accent" href="/c/{data.calendar.id}/members/virtual/new"
			><Plus size={20} /> Add virtual member</a
		>
	</div>
</main>

<a
	href="/c/{data.calendar.id}/invite"
	class="btn btn-primary fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] z-30 rounded-full shadow-lg"
>
	<UserPlus size={18} /> Invite members
</a>

<Sheet bind:open={sheetOpen}>
	{#if selected}
		<div class="flex flex-col items-center px-6 pt-2 pb-6 text-center">
			<Avatar name={selected.name} fileId={selected.avatarFileId} size={84} />
			<h2 class="mt-3 text-lg font-bold">{selected.name}</h2>
			{#if selected.statusText}<p class="mt-1 text-sm text-muted">{selected.statusText}</p>{/if}
			{#if selected.attribute}<p class="mt-1 text-xs text-muted">
					{MEMBER_ATTRIBUTE_LABELS[selected.attribute]}
				</p>{/if}
			{#if selected.birthday}<p class="mt-3 text-sm">{birthdayCountdown(selected.birthday)}</p>{/if}
			{#if selected.lastAccessedAt && !selected.isMe}
				<p class="mt-1 text-xs text-muted">
					Last checked the calendar {formatDistanceToNow(selected.lastAccessedAt, {
						addSuffix: true
					})}
				</p>
			{/if}
			{#if selected.isMe}
				<a class="btn btn-secondary mt-5 w-full" href="/settings/profile">Edit profile</a>
			{:else if isOwner}
				<button class="btn btn-ghost mt-5 w-full !text-danger" onclick={() => kick(selected!)}
					>Remove from calendar</button
				>
			{/if}
		</div>
	{/if}
</Sheet>
