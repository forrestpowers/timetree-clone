<script lang="ts">
	import { page } from '$app/state';
	import { format } from 'date-fns';
	import QRCode from 'qrcode';
	import Copy from '@lucide/svelte/icons/copy';
	import Share2 from '@lucide/svelte/icons/share-2';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { APP_NAME } from '$app/env/public';
	import { api } from '#lib/api.js';
	import { toast } from '#lib/toast.svelte.js';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let url = $state('');
	let expiresAt = $state(0);
	$effect.pre(() => {
		url = data.inviteUrl;
		expiresAt = data.expiresAt;
	});
	let qrOpen = $state(false);
	let qrDataUrl = $state('');
	const created = $derived(page.url.searchParams.get('created') === '1');

	const message = $derived(
		`You're invited to the "${data.calendar.name}" calendar on ${APP_NAME}.\nOpen this link to join:\n${url}`
	);
	const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

	async function copy() {
		await navigator.clipboard.writeText(url);
		toast('The link has been copied.');
	}

	async function share() {
		try {
			await navigator.share({ title: `Invitation to ${data.calendar.name}`, text: message });
		} catch {
			/* cancelled */
		}
	}

	async function showQr() {
		qrDataUrl = await QRCode.toDataURL(url, { width: 640, margin: 2 });
		qrOpen = true;
	}

	async function regenerate() {
		if (!confirm('Create a new link? The current link and QR code will stop working.')) return;
		const res = await api<{ url: string; expiresAt: number }>(
			`/api/calendars/${data.calendar.id}/invite`,
			'POST',
			{ regenerate: true }
		);
		url = res.url;
		expiresAt = res.expiresAt;
		toast('New invitation link created');
	}
</script>

<svelte:head><title>Invite members</title></svelte:head>

<PageHeader title="Invite Members" back="/c/{data.calendar.id}" close={created} />

<main class="mx-auto max-w-xl px-4 pt-6 pb-10">
	{#if created}
		<div class="mb-6 rounded-2xl bg-accent-soft p-4">
			<p class="font-semibold">"{data.calendar.name}" is ready 🎉</p>
			<p class="mt-1 text-sm">Send the invitation link. They tap it, then tap Join.</p>
		</div>
	{/if}

	<div class="card p-4">
		<p class="text-sm text-muted">Invitation link</p>
		<p class="mt-1 font-mono text-sm break-all">{url}</p>
		<p class="mt-2 text-xs text-muted">Valid until {format(expiresAt, 'MMM d, yyyy')}</p>
	</div>

	<div class="mt-4 grid gap-2">
		{#if canShare}<button class="btn btn-primary" onclick={share}
				><Share2 size={18} /> Share invitation</button
			>{/if}
		<button class={['btn', canShare ? 'btn-secondary' : 'btn-primary']} onclick={copy}
			><Copy size={18} /> Copy invitation link</button
		>
		<button class="btn btn-secondary" onclick={showQr}
			><QrCode size={18} /> Invite via QR code</button
		>
	</div>

	<button class="btn btn-ghost mt-6 w-full text-sm" onclick={regenerate}
		><RefreshCw size={16} /> Create a new link</button
	>

	{#if created}
		<a class="btn btn-ghost mt-2 w-full" href="/c/{data.calendar.id}">Skip for now</a>
	{/if}
</main>

<Sheet bind:open={qrOpen} title="QR Code Invitation">
	<div class="flex flex-col items-center px-6 pb-6">
		<img
			src={qrDataUrl}
			alt="QR code for the invitation link"
			class="w-64 rounded-xl bg-white p-2"
		/>
		<p class="mt-3 text-center text-sm text-muted">
			Scan the QR code with a camera app to join the calendar.
		</p>
		<p class="mt-1 text-xs text-muted">Valid until {format(expiresAt, 'MMM d, yyyy')}</p>
		<a class="btn btn-secondary mt-4" href={qrDataUrl} download="invitation-qr.png">Save as image</a
		>
	</div>
</Sheet>
