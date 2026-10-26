<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { toast } from '#lib/toast.svelte.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import ImageUpload from '#lib/components/ImageUpload.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Toggle from '#lib/components/Toggle.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const user = $derived(data.user!);

	let name = $state('');
	let statusText = $state('');
	let birthday = $state('');
	let showBirthday = $state(false);
	$effect.pre(() => {
		name = user.name;
		statusText = user.statusText;
		birthday = user.birthday ?? '';
		showBirthday = user.showBirthday;
	});
	const dirty = $derived(
		name !== user.name ||
			statusText !== user.statusText ||
			(birthday || null) !== user.birthday ||
			showBirthday !== user.showBirthday
	);

	async function patch(body: Record<string, unknown>, message = 'Profile saved') {
		try {
			await api('/api/me', 'PATCH', body);
			await invalidateAll();
			toast(message);
		} catch (e) {
			toast((e as Error).message, 'error');
		}
	}
</script>

<svelte:head><title>Profile</title></svelte:head>

<PageHeader title="Edit Profile" back="/more">
	{#snippet actions()}
		<button
			class="btn btn-ghost !px-3 !py-1.5"
			disabled={!dirty || !name.trim()}
			onclick={() => patch({ name, statusText, birthday: birthday || null, showBirthday })}
			>Save</button
		>
	{/snippet}
</PageHeader>

<main class="mx-auto max-w-xl pb-10">
	<div class="flex flex-col items-center gap-2 pt-6">
		<ImageUpload
			kind="avatar"
			maxSize={512}
			onuploaded={(id) => patch({ avatarFileId: id }, 'Photo updated')}
		>
			{#snippet children({ busy })}
				<Avatar name={name || user.email} fileId={user.avatarFileId} size={96} />
				<span class="mt-2 block text-sm text-accent">{busy ? 'Uploading…' : 'Change photo'}</span>
			{/snippet}
		</ImageUpload>
		{#if user.avatarFileId}
			<button
				class="text-xs text-muted"
				onclick={() => patch({ avatarFileId: null }, 'Photo removed')}>Remove photo</button
			>
		{/if}
	</div>

	<div class="mt-6 divide-y divide-border border-y border-border bg-surface">
		<label class="list-row">
			<span class="w-28 shrink-0 text-muted">Name</span>
			<input
				class="min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0"
				maxlength="50"
				placeholder="Required"
				bind:value={name}
			/>
		</label>
		<label class="list-row">
			<span class="w-28 shrink-0 text-muted">Status</span>
			<input
				class="min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0"
				maxlength="100"
				placeholder="What are you up to?"
				bind:value={statusText}
			/>
		</label>
		<label class="list-row">
			<span class="w-28 shrink-0 text-muted">Birthday</span>
			<input
				class="min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0"
				type="date"
				bind:value={birthday}
			/>
		</label>
		<div class="list-row">
			<span class="flex-1">
				<span class="block">Display birthday</span>
				<span class="text-xs text-muted">Show it to members and on their calendars</span>
			</span>
			<Toggle label="Display birthday" bind:checked={showBirthday} />
		</div>
	</div>
	<p class="px-4 pt-3 text-xs text-muted">
		This profile is used in every calendar unless you set a calendar profile in that calendar's
		settings.
	</p>
</main>
