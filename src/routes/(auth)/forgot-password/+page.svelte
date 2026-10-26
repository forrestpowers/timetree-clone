<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Reset password</title></svelte:head>

<h2 class="mb-1 text-lg font-semibold">Forgot password</h2>
{#if form?.sent}
	<p class="card p-4 text-sm">
		If <strong>{form.email}</strong> belongs to an account, a reset link is on its way. Check your inbox.
	</p>
{:else}
	<p class="mb-4 text-sm text-muted">We'll email you a link to set a new password.</p>
	<form method="POST" class="flex flex-col gap-3" use:enhance>
		<input
			class="field"
			type="email"
			name="email"
			placeholder="Email address"
			autocomplete="email"
			required
			value={form?.email ?? ''}
		/>
		{#if form?.message}<p class="text-sm text-danger" role="alert">{form.message}</p>{/if}
		<button class="btn btn-primary">Send email</button>
	</form>
{/if}
<a class="mt-8 self-center text-sm text-accent" href="/login">Back to log in</a>
