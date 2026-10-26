<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { format } from 'date-fns';
	import Avatar from '#lib/components/Avatar.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import { purposeOf } from '#lib/meta.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let profile = $state<'account' | 'calendar'>('account');
	const next = $derived(encodeURIComponent(page.url.pathname));
</script>

<svelte:head><title>Invitation</title></svelte:head>

<main class="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-10">
	{#if !data.valid}
		<div class="flex flex-col items-center text-center">
			<Logo size={56} />
			<h1 class="mt-6 text-xl font-bold">Invalid invitation</h1>
			<p class="mt-2 text-muted">
				This invitation link has expired or was replaced. Ask for a new link.
			</p>
			<a href="/" class="btn btn-primary mt-8 w-full">Open calendar</a>
		</div>
	{:else}
		<p class="text-center text-sm font-semibold text-accent">Invitation</p>
		<div class="card mt-4 overflow-hidden">
			{#if data.calendar.coverFileId && data.me}
				<img src="/files/{data.calendar.coverFileId}" alt="" class="h-36 w-full object-cover" />
			{:else}
				<div class="flex h-28 items-center justify-center bg-accent-soft text-5xl">
					{purposeOf(data.calendar.purpose).emoji}
				</div>
			{/if}
			<div class="p-5">
				<h1 class="text-xl font-bold">{data.calendar.name}</h1>
				{#if data.inviterName}<p class="mt-1 text-sm text-muted">
						Inviter: {data.inviterName}
					</p>{/if}
				<p class="mt-1 text-sm text-muted">Members ({data.memberCount})</p>
				{#if data.members.length}
					<div class="mt-3 flex -space-x-2">
						{#each data.members.slice(0, 8) as m (m.id)}<Avatar
								name={m.name}
								fileId={m.avatarFileId}
								size={32}
								ring
							/>{/each}
					</div>
				{/if}
				<p class="mt-3 text-xs text-muted">
					The invitation link is valid until {format(data.expiresAt, 'MMM d, yyyy')}.
				</p>
			</div>
		</div>

		{#if !data.me}
			<p class="mt-6 text-center text-sm text-muted">To join, create an account or log in.</p>
			<a class="btn btn-primary mt-3" href="/signup?next={next}">Create account and join</a>
			<a class="btn btn-secondary mt-2" href="/login?next={next}">I already have an account</a>
		{:else if data.alreadyMember}
			<p class="mt-6 text-center text-sm text-muted">You're already a member of this calendar.</p>
			<a class="btn btn-primary mt-3" href="/c/{data.calendar.id}">Open calendar</a>
		{:else}
			<form method="POST" class="mt-6 flex flex-col gap-3" use:enhance>
				<p class="text-sm font-semibold">Select profile</p>
				<label
					class={[
						'card flex items-center gap-3 p-3',
						profile === 'account' && 'border-accent ring-1 ring-accent'
					]}
				>
					<input
						type="radio"
						name="profile"
						value="account"
						bind:group={profile}
						class="text-accent"
					/>
					<Avatar name={data.me.name} fileId={data.me.avatarFileId} size={36} />
					<span class="flex-1"
						><span class="block font-medium">{data.me.name}</span><span class="text-xs text-muted"
							>Your profile</span
						></span
					>
				</label>
				<label
					class={[
						'card flex flex-col gap-2 p-3',
						profile === 'calendar' && 'border-accent ring-1 ring-accent'
					]}
				>
					<span class="flex items-center gap-3">
						<input
							type="radio"
							name="profile"
							value="calendar"
							bind:group={profile}
							class="text-accent"
						/>
						<span class="flex-1"
							><span class="block font-medium">New profile</span><span class="text-xs text-muted"
								>A different name, just for this calendar</span
							></span
						>
					</span>
					{#if profile === 'calendar'}
						<input
							class="field"
							name="profileName"
							placeholder="Name in this calendar"
							maxlength="50"
						/>
					{/if}
				</label>
				{#if form?.message}<p class="text-sm text-danger">{form.message}</p>{/if}
				<button class="btn btn-primary mt-2">Join</button>
			</form>
		{/if}
	{/if}
</main>
