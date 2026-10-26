<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { PURPOSES, purposeOf } from '#lib/meta.js';
	import type { CalendarPurpose } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { form, data }: PageProps = $props();
	const first = $derived(page.url.searchParams.get('first') === '1' && !data.calendars.length);

	let purpose = $state<CalendarPurpose | null>(null);
	let name = $state('');
	$effect.pre(() => {
		if (form?.purpose) purpose = form.purpose as CalendarPurpose;
		if (form?.name) name = form.name;
	});

	function pick(id: CalendarPurpose) {
		if (!name || PURPOSES.some((p) => p.label === name)) name = purposeOf(id).label;
		purpose = id;
	}
</script>

<svelte:head><title>Create calendar</title></svelte:head>

<PageHeader title="Create Calendar" back={first ? undefined : '/calendars'} close />

<main class="mx-auto max-w-xl px-4 pb-10">
	{#if first}
		<div class="pt-6 pb-2">
			<h2 class="text-xl font-bold">Welcome!</h2>
			<p class="mt-1 text-muted">
				Create your first calendar. If someone invited you, open the invitation link they sent
				instead.
			</p>
		</div>
	{/if}

	<p class="section-title !px-0">What type of calendar are you creating?</p>
	<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
		{#each PURPOSES as p (p.id)}
			<button
				type="button"
				class={[
					'card flex flex-col items-start gap-1 p-3 text-left transition',
					purpose === p.id && 'border-accent bg-accent-soft ring-1 ring-accent'
				]}
				onclick={() => pick(p.id)}
				aria-pressed={purpose === p.id}
			>
				<span class="text-2xl">{p.emoji}</span>
				<span class="font-semibold">{p.label}</span>
				<span class="line-clamp-2 text-xs text-muted">{p.description}</span>
			</button>
		{/each}
	</div>

	{#if purpose}
		<form method="POST" class="mt-6 flex flex-col gap-3" use:enhance>
			<input type="hidden" name="purpose" value={purpose} />
			<label class="flex flex-col gap-1.5">
				<span class="text-sm font-medium">Calendar name</span>
				<input class="field" name="name" maxlength="50" required bind:value={name} />
			</label>
			{#if form?.message}<p class="text-sm text-danger" role="alert">{form.message}</p>{/if}
			<button class="btn btn-primary">Create</button>
		</form>
	{/if}
</main>
