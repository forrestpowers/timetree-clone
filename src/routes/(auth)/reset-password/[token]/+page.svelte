<script lang="ts">
	import { enhance } from '$app/forms';
	import PasswordChecks from '#lib/components/PasswordChecks.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let password = $state('');
	let confirm = $state('');
</script>

<svelte:head><title>Set a new password</title></svelte:head>

{#if !data.valid}
	<p class="card p-4 text-sm">This link has expired or was already used.</p>
	<a class="btn btn-primary mt-4" href="/forgot-password">Request a new link</a>
{:else}
	<h2 class="mb-4 text-lg font-semibold">Set a new password</h2>
	<form
		method="POST"
		class="flex flex-col gap-3"
		use:enhance={() =>
			async ({ update }) =>
				update({ reset: false })}
	>
		<input
			class="field"
			type="password"
			name="password"
			placeholder="New password"
			autocomplete="new-password"
			required
			bind:value={password}
		/>
		<input
			class="field"
			type="password"
			name="confirm"
			placeholder="Confirm new password"
			autocomplete="new-password"
			required
			bind:value={confirm}
		/>
		<PasswordChecks {password} {confirm} />
		{#if form?.message}<p class="text-sm text-danger" role="alert">{form.message}</p>{/if}
		<button class="btn btn-primary mt-2">Save password</button>
	</form>
	<p class="mt-4 text-xs text-muted">You'll be signed out on all other devices.</p>
{/if}
