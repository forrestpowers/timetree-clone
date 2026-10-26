<script lang="ts">
	import { enhance } from '$app/forms';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import PasswordChecks from '#lib/components/PasswordChecks.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const user = $derived(data.user!);
	let open = $state<'email' | 'password' | 'delete' | null>(null);
	let newPassword = $state('');
	let confirmPassword = $state('');

	const msg = (section: string) =>
		form && 'section' in form && form.section === section ? form.message : null;
	const keep =
		() =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<svelte:head><title>Account</title></svelte:head>

<PageHeader title="Manage Account" back="/more" />

<main class="mx-auto max-w-xl pb-12">
	<p class="section-title">Email address</p>
	<div class="border-y border-border bg-surface">
		<div class="list-row">
			<span class="min-w-0 flex-1 truncate">{user.email}</span>
			{#if user.emailVerified}
				<span class="flex items-center gap-1 text-xs text-accent"
					><CircleCheck size={14} /> Verified</span
				>
			{:else}
				<span class="flex items-center gap-1 text-xs text-amber-600"
					><TriangleAlert size={14} /> Pending verification</span
				>
			{/if}
		</div>
		{#if !user.emailVerified}
			<form method="POST" action="?/resend" use:enhance class="px-4 pb-3">
				<p class="text-xs text-muted">
					Didn't receive the verification email? Check spam, or send it again.
				</p>
				<button class="btn btn-secondary mt-2 !py-1.5 text-sm">Resend email</button>
				{#if msg('verify')}<p class="mt-2 text-sm">{msg('verify')}</p>{/if}
			</form>
		{/if}
	</div>

	<div class="mt-6 divide-y divide-border border-y border-border bg-surface">
		<button class="list-row" onclick={() => (open = open === 'email' ? null : 'email')}
			>Change email address</button
		>
		{#if open === 'email' || msg('email')}
			<form method="POST" action="?/email" use:enhance={keep} class="flex flex-col gap-2 px-4 py-3">
				<input
					class="field"
					type="email"
					name="email"
					placeholder="New email address"
					required
					autocomplete="email"
				/>
				{#if user.hasPassword}<input
						class="field"
						type="password"
						name="password"
						placeholder="Current password"
						required
						autocomplete="current-password"
					/>{/if}
				{#if msg('email')}<p class="text-sm">{msg('email')}</p>{/if}
				<button class="btn btn-primary">Send confirmation email</button>
			</form>
		{/if}

		<button class="list-row" onclick={() => (open = open === 'password' ? null : 'password')}
			>{user.hasPassword ? 'Change password' : 'Set a password'}</button
		>
		{#if open === 'password' || msg('password')}
			<form
				method="POST"
				action="?/password"
				use:enhance={keep}
				class="flex flex-col gap-2 px-4 py-3"
			>
				{#if user.hasPassword}<input
						class="field"
						type="password"
						name="current"
						placeholder="Current password"
						required
						autocomplete="current-password"
					/>{/if}
				<input
					class="field"
					type="password"
					name="new"
					placeholder="New password"
					required
					autocomplete="new-password"
					bind:value={newPassword}
				/>
				<input
					class="field"
					type="password"
					name="confirm"
					placeholder="Confirm new password"
					required
					autocomplete="new-password"
					bind:value={confirmPassword}
				/>
				<PasswordChecks password={newPassword} confirm={confirmPassword} />
				{#if msg('password')}<p class="text-sm">{msg('password')}</p>{/if}
				<button class="btn btn-primary">Change</button>
			</form>
		{/if}
	</div>

	<div class="mt-10 border-y border-border bg-surface">
		<button
			class="list-row text-danger"
			onclick={() => (open = open === 'delete' ? null : 'delete')}>Leave and delete account</button
		>
		{#if open === 'delete' || msg('delete')}
			<form
				method="POST"
				action="?/delete"
				use:enhance={keep}
				class="flex flex-col gap-2 px-4 pb-4"
			>
				<p class="text-sm text-muted">
					You'll leave all your calendars. Calendars where you're the only member are deleted. A
					deleted account can't be recovered.
				</p>
				{#if user.hasPassword}<input
						class="field"
						type="password"
						name="password"
						placeholder="Current password"
						required
						autocomplete="current-password"
					/>{/if}
				<input
					class="field"
					name="confirm"
					placeholder="Type DELETE to confirm"
					required
					autocomplete="off"
				/>
				{#if msg('delete')}<p class="text-sm text-danger">{msg('delete')}</p>{/if}
				<button class="btn btn-danger">Delete my account</button>
			</form>
		{/if}
	</div>
</main>
