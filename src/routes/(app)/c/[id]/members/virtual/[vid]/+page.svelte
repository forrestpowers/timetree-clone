<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { VIRTUAL_PRESETS } from '#lib/meta.js';
	import { toast } from '#lib/toast.svelte.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import ImageUpload from '#lib/components/ImageUpload.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Toggle from '#lib/components/Toggle.svelte';
	import type { ClientVirtualMember } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let preset = $state<ClientVirtualMember['preset'] | null>(null);
	let name = $state('');
	let avatarFileId = $state<string | null>(null);
	let birthday = $state('');
	let showBirthday = $state(true);
	let statusText = $state('');
	let saving = $state(false);
	$effect.pre(() => {
		const v = data.virtual;
		preset = v?.preset ?? null;
		name = v?.name ?? '';
		avatarFileId = v?.avatarFileId ?? null;
		birthday = v?.birthday ?? '';
		showBirthday = v ? v.showBirthday : true;
		statusText = v?.statusText ?? '';
	});

	const back = $derived(`/c/${data.calendarId}/members`);
	const presetInfo = $derived(VIRTUAL_PRESETS.find((p) => p.id === preset));

	function choose(id: ClientVirtualMember['preset']) {
		preset = id;
		if (!name) name = id === 'other' ? '' : VIRTUAL_PRESETS.find((p) => p.id === id)!.label;
	}

	async function save() {
		if (!preset) return;
		saving = true;
		try {
			const body = {
				preset,
				name,
				avatarFileId,
				birthday: birthday || null,
				showBirthday,
				statusText
			};
			if (data.virtual)
				await api(
					`/api/calendars/${data.calendarId}/virtual-members/${data.virtual.id}`,
					'PUT',
					body
				);
			else await api(`/api/calendars/${data.calendarId}/virtual-members`, 'POST', body);
			goto(back, { refreshAll: true });
		} catch (e) {
			toast((e as Error).message, 'error');
		} finally {
			saving = false;
		}
	}

	async function remove() {
		if (!data.virtual) return;
		if (
			!confirm(
				`Delete ${data.virtual.name}? They will also be removed from the attendee list of every event. This can't be undone.`
			)
		)
			return;
		await api(`/api/calendars/${data.calendarId}/virtual-members/${data.virtual.id}`, 'DELETE');
		goto(back, { refreshAll: true });
	}
</script>

<svelte:head><title>Virtual member</title></svelte:head>

<PageHeader
	title={data.virtual ? 'Edit virtual member' : 'Add virtual member'}
	{back}
	close={!data.virtual}
>
	{#snippet actions()}
		{#if preset}<button
				class="btn btn-ghost !px-3 !py-1.5"
				onclick={save}
				disabled={saving || !name.trim()}>Save</button
			>{/if}
	{/snippet}
</PageHeader>

<main class="mx-auto max-w-xl pb-10">
	{#if !preset}
		<p class="px-4 pt-5 text-sm text-muted">
			Create members without an account, such as children or pets, and add them as event attendees.
		</p>
		<p class="section-title">Select virtual member to create</p>
		<div class="grid grid-cols-3 gap-2.5 px-4">
			{#each VIRTUAL_PRESETS as p (p.id)}
				<button class="card flex flex-col items-center gap-1 py-4" onclick={() => choose(p.id)}>
					<span class="text-3xl">{p.emoji}</span>
					<span class="text-sm font-medium">{p.label}</span>
				</button>
			{/each}
		</div>
	{:else}
		<div class="flex flex-col items-center pt-6">
			<ImageUpload
				kind="avatar"
				maxSize={512}
				onuploaded={(id) => {
					avatarFileId = id;
				}}
				class="relative"
			>
				{#snippet children({ busy })}
					{#if avatarFileId}
						<Avatar {name} fileId={avatarFileId} size={88} />
					{:else}
						<span
							class="flex size-22 items-center justify-center rounded-full bg-surface-2 text-5xl"
							>{presetInfo?.emoji}</span
						>
					{/if}
					<span class="mt-2 block text-xs text-accent">{busy ? 'Uploading…' : 'Change photo'}</span>
				{/snippet}
			</ImageUpload>
		</div>

		<div class="mt-6 divide-y divide-border border-y border-border bg-surface">
			<label class="list-row">
				<span class="w-32 shrink-0 text-muted">Name</span>
				<input
					class="min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0"
					maxlength="50"
					placeholder="Required"
					bind:value={name}
				/>
			</label>
			<label class="list-row">
				<span class="w-32 shrink-0 text-muted"
					>{preset === 'car' ? 'Delivery date' : 'Birthday'}</span
				>
				<input
					class="min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0"
					type="date"
					bind:value={birthday}
				/>
			</label>
			{#if preset !== 'car'}
				<div class="list-row">
					<span class="flex-1">Display birthday on calendar</span>
					<Toggle label="Display birthday on calendar" bind:checked={showBirthday} />
				</div>
			{/if}
			<label class="list-row">
				<span class="w-32 shrink-0 text-muted">Status</span>
				<input
					class="min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0"
					maxlength="100"
					placeholder="Optional"
					bind:value={statusText}
				/>
			</label>
		</div>

		{#if data.virtual}
			<button class="list-row mt-8 border-y border-border bg-surface text-danger" onclick={remove}
				>Delete virtual member</button
			>
		{/if}
	{/if}
</main>
