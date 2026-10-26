<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { startAuthentication } from '@simplewebauthn/browser';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let pending = $state(false);
	let passkeyError = $state('');

	const next = $derived(page.url.searchParams.get('next') ?? '');
	const qs = $derived(next ? `?next=${encodeURIComponent(next)}` : '');

	async function passkeyLogin() {
		passkeyError = '';
		try {
			const options = await fetch('/api/auth/passkey/login/options', { method: 'POST' }).then((r) =>
				r.json()
			);
			const response = await startAuthentication({ optionsJSON: options });
			const res = await fetch('/api/auth/passkey/login/verify', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(response)
			});
			if (!res.ok)
				throw new Error((await res.json().catch(() => null))?.message ?? 'Passkey sign-in failed.');
			window.location.href = next.startsWith('/') && !next.startsWith('//') ? next : '/';
		} catch (e) {
			const err = e as Error;
			if (err.name !== 'NotAllowedError') passkeyError = err.message;
		}
	}
</script>

<svelte:head><title>Log in</title></svelte:head>

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
		<span class="text-sm font-medium">Email address</span>
		<input
			class="field"
			type="email"
			name="email"
			autocomplete="username webauthn"
			required
			value={form?.email ?? ''}
		/>
	</label>
	<label class="flex flex-col gap-1.5">
		<span class="text-sm font-medium">Password</span>
		<input class="field" type="password" name="password" autocomplete="current-password" required />
	</label>
	{#if form?.message}<p class="text-sm text-danger" role="alert">{form.message}</p>{/if}
	<button class="btn btn-primary mt-2" disabled={pending}>Log in</button>
	<a class="self-center py-2 text-sm text-accent" href="/forgot-password">Forgot password?</a>
</form>

<div class="my-4 flex items-center gap-3 text-xs text-muted">
	<div class="h-px flex-1 bg-border"></div>
	or
	<div class="h-px flex-1 bg-border"></div>
</div>

<button class="btn btn-secondary w-full" onclick={passkeyLogin}>
	<KeyRound size={18} /> Sign in with a passkey
</button>
{#if passkeyError}<p class="mt-2 text-sm text-danger" role="alert">{passkeyError}</p>{/if}

<p class="mt-8 text-center text-sm text-muted">
	Don't have an account? <a class="font-semibold text-accent" href="/signup{qs}">Create one</a>
</p>
