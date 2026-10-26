<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
	import { formatDistanceToNow } from 'date-fns';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Laptop from '@lucide/svelte/icons/laptop';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Plus from '@lucide/svelte/icons/plus';
	import { api } from '#lib/api.js';
	import { toast } from '#lib/toast.svelte.js';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let adding = $state(false);
	const supported = typeof window !== 'undefined' && browserSupportsWebAuthn();

	function deviceName(ua: string) {
		if (/iPhone/.test(ua)) return 'iPhone';
		if (/iPad/.test(ua)) return 'iPad';
		if (/Android/.test(ua)) return 'Android';
		if (/Macintosh/.test(ua)) return 'Mac';
		if (/Windows/.test(ua)) return 'Windows PC';
		if (/Linux/.test(ua)) return 'Linux';
		return 'Unknown device';
	}
	function browserName(ua: string) {
		if (/Edg\//.test(ua)) return 'Edge';
		if (/CriOS|Chrome\//.test(ua)) return 'Chrome';
		if (/FxiOS|Firefox\//.test(ua)) return 'Firefox';
		if (/Safari\//.test(ua)) return 'Safari';
		return '';
	}

	async function addPasskey() {
		adding = true;
		try {
			const options = await api<Parameters<typeof startRegistration>[0]['optionsJSON']>(
				'/api/auth/passkey/register/options',
				'POST'
			);
			const response = await startRegistration({ optionsJSON: options });
			const name = `${deviceName(navigator.userAgent)} passkey`;
			await api('/api/auth/passkey/register/verify', 'POST', { response, name });
			await invalidate('app:security');
			toast('Passkey added');
		} catch (e) {
			const err = e as Error;
			if (err.name !== 'NotAllowedError') toast(err.message, 'error');
		} finally {
			adding = false;
		}
	}
</script>

<svelte:head><title>Passkeys &amp; devices</title></svelte:head>

<PageHeader title="Passkeys & devices" back="/more" />

<main class="mx-auto max-w-xl pb-12">
	<p class="section-title">Passkeys</p>
	<p class="-mt-1 px-4 pb-2 text-xs text-muted">
		Sign in with Face ID, Touch ID or your device PIN instead of a password.
	</p>
	<div class="divide-y divide-border border-y border-border bg-surface">
		{#each data.passkeys as pk (pk.id)}
			<div class="list-row">
				<KeyRound size={20} class="shrink-0 text-muted" />
				<form method="POST" action="?/renamePasskey" use:enhance class="min-w-0 flex-1">
					<input type="hidden" name="id" value={pk.id} />
					<input
						name="name"
						value={pk.name}
						maxlength="60"
						class="w-full border-0 bg-transparent p-0 font-medium focus:ring-0"
						onchange={(e) => e.currentTarget.form?.requestSubmit()}
					/>
					<span class="block text-xs text-muted">
						Added {formatDistanceToNow(pk.createdAt, { addSuffix: true })}{pk.lastUsedAt
							? ` · Last used ${formatDistanceToNow(pk.lastUsedAt, { addSuffix: true })}`
							: ''}
					</span>
				</form>
				<form
					method="POST"
					action="?/deletePasskey"
					use:enhance={({ cancel }) => {
						if (!confirm('Remove this passkey?')) cancel();
					}}
				>
					<input type="hidden" name="id" value={pk.id} />
					<button class="icon-btn text-muted" aria-label="Remove passkey"
						><Trash2 size={18} /></button
					>
				</form>
			</div>
		{/each}
		{#if supported}
			<button class="list-row text-accent" onclick={addPasskey} disabled={adding}
				><Plus size={20} /> {adding ? 'Waiting for your device…' : 'Add a passkey'}</button
			>
		{:else}
			<p class="list-row text-sm text-muted">This browser doesn't support passkeys.</p>
		{/if}
	</div>

	<p class="section-title">Signed-in devices</p>
	<div class="divide-y divide-border border-y border-border bg-surface">
		{#each data.sessions as s (s.id)}
			<div class="list-row">
				{#if /iPhone|Android/.test(s.userAgent)}<Smartphone
						size={20}
						class="shrink-0 text-muted"
					/>{:else}<Laptop size={20} class="shrink-0 text-muted" />{/if}
				<span class="min-w-0 flex-1">
					<span class="block font-medium"
						>{deviceName(s.userAgent)}
						{browserName(s.userAgent)}{s.current ? ' · This device' : ''}</span
					>
					<span class="block text-xs text-muted"
						>Active {formatDistanceToNow(s.lastSeenAt, { addSuffix: true })}{s.ip
							? ` · ${s.ip}`
							: ''}</span
					>
				</span>
				{#if !s.current}
					<form method="POST" action="?/revokeSession" use:enhance>
						<input type="hidden" name="id" value={s.id} />
						<button class="btn btn-ghost !px-2 !py-1 text-sm">Log out</button>
					</form>
				{/if}
			</div>
		{/each}
	</div>
	<form
		method="POST"
		action="/logout?/all"
		use:enhance={({ cancel }) => {
			if (!confirm('You will be logged out from all devices, including this one. Are you sure?'))
				cancel();
		}}
		class="mt-6 border-y border-border bg-surface"
	>
		<button class="list-row text-danger">Log out of all devices</button>
	</form>
</main>
