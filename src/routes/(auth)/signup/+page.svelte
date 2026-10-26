<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import PasswordChecks from '#lib/components/PasswordChecks.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let password = $state('');
	let confirm = $state('');
	let pending = $state(false);

	const next = $derived(page.url.searchParams.get('next') ?? '');
	const qs = $derived(next ? `?next=${encodeURIComponent(next)}` : '');
</script>

<svelte:head><title>Create account</title></svelte:head>

{#if !data.allowed}
	<div class="card p-5 text-center">
		<p class="font-semibold">Sign-up is by invitation</p>
		<p class="mt-2 text-sm text-muted">
			Ask a family member to send you an invitation link from their calendar, then open it on this
			device.
		</p>
	</div>
	<p class="mt-8 text-center text-sm text-muted">
		Already have an account? <a class="font-semibold text-accent" href="/login{qs}">Log in</a>
	</p>
{:else}
	{#if data.firstUser}
		<p class="mb-4 rounded-xl bg-accent-soft p-3 text-sm">
			You're the first person here. Your account will be able to invite everyone else.
		</p>
	{/if}
	<form
		method="POST"
		class="flex flex-col gap-3"
		use:enhance={() => {
			pending = true;
			return async ({ update }) => {
				await update({ reset: false });
				pending = false;
			};
		}}
	>
		<label class="flex flex-col gap-1.5">
			<span class="text-sm font-medium">Your name</span>
			<input
				class="field"
				name="name"
				autocomplete="name"
				maxlength="50"
				required
				value={form?.name ?? ''}
			/>
		</label>
		<label class="flex flex-col gap-1.5">
			<span class="text-sm font-medium">Email address</span>
			<input
				class="field"
				type="email"
				name="email"
				autocomplete="email"
				required
				value={form?.email ?? ''}
			/>
		</label>
		<label class="flex flex-col gap-1.5">
			<span class="text-sm font-medium">Password</span>
			<input
				class="field"
				type="password"
				name="password"
				autocomplete="new-password"
				required
				bind:value={password}
			/>
		</label>
		<label class="flex flex-col gap-1.5">
			<span class="text-sm font-medium">Confirm password</span>
			<input
				class="field"
				type="password"
				name="confirm"
				autocomplete="new-password"
				required
				bind:value={confirm}
			/>
		</label>
		<PasswordChecks {password} {confirm} />
		{#if form?.message}<p class="text-sm text-danger" role="alert">{form.message}</p>{/if}
		<button class="btn btn-primary mt-2" disabled={pending}>Create account</button>
	</form>
	<p class="mt-8 text-center text-sm text-muted">
		Already have an account? <a class="font-semibold text-accent" href="/login{qs}">Log in</a>
	</p>
{/if}
