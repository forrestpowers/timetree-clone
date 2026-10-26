<script lang="ts">
	import { enhance } from '$app/forms';
	import { APP_NAME } from '$app/env/public';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import LayoutList from '@lucide/svelte/icons/layout-list';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Mail from '@lucide/svelte/icons/mail';
	import Paintbrush from '@lucide/svelte/icons/paintbrush';
	import Plus from '@lucide/svelte/icons/plus';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Avatar from '#lib/components/Avatar.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const user = $derived(data.user!);
</script>

<svelte:head><title>More</title></svelte:head>

<header class="pt-safe sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
	<div class="flex h-13 items-center px-4"><h1 class="text-[17px] font-semibold">More</h1></div>
</header>

<main class="mx-auto max-w-xl pb-8">
	<a
		href="/settings/profile"
		class="mt-3 flex items-center gap-4 border-y border-border bg-surface px-4 py-4"
	>
		<Avatar name={user.name || user.email} fileId={user.avatarFileId} size={56} />
		<span class="min-w-0 flex-1">
			<span class="block truncate text-lg font-semibold">{user.name || 'Add your name'}</span>
			<span class="block truncate text-sm text-muted">{user.statusText || user.email}</span>
		</span>
		<ChevronRight size={18} class="text-muted" />
	</a>

	{#if !user.emailVerified}
		<a
			href="/settings/account"
			class="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-amber-500/12 p-3 text-sm"
		>
			<TriangleAlert size={18} class="shrink-0 text-amber-600" />
			<span class="flex-1"
				>Please complete email verification so you can always recover your account.</span
			>
		</a>
	{/if}

	<p class="section-title">Calendars</p>
	<div class="divide-y divide-border border-y border-border bg-surface">
		<a class="list-row" href="/calendars"
			><LayoutList size={20} class="text-muted" /><span class="flex-1">Calendar list</span
			><ChevronRight size={18} class="text-muted" /></a
		>
		<a class="list-row" href="/calendars/new"
			><Plus size={20} class="text-muted" /><span class="flex-1">Create calendar</span><ChevronRight
				size={18}
				class="text-muted"
			/></a
		>
	</div>

	<p class="section-title">Settings</p>
	<div class="divide-y divide-border border-y border-border bg-surface">
		<a class="list-row" href="/settings/appearance"
			><Paintbrush size={20} class="text-muted" /><span class="flex-1">Appearance</span
			><ChevronRight size={18} class="text-muted" /></a
		>
		<a class="list-row" href="/settings/account"
			><Mail size={20} class="text-muted" /><span class="flex-1">Account</span><ChevronRight
				size={18}
				class="text-muted"
			/></a
		>
		<a class="list-row" href="/settings/security"
			><KeyRound size={20} class="text-muted" /><span class="flex-1">Passkeys &amp; devices</span
			><ChevronRight size={18} class="text-muted" /></a
		>
	</div>

	<form
		method="POST"
		action="/logout?/logout"
		use:enhance
		class="mt-8 border-y border-border bg-surface"
	>
		<button class="list-row text-danger"><LogOut size={20} /> Log out</button>
	</form>

	<p class="mt-6 text-center text-xs text-muted">{APP_NAME}</p>
</main>
