<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Check from '@lucide/svelte/icons/check';
	import { api } from '#lib/api.js';
	import { deviceTimeZone } from '#lib/dates.js';
	import { toast } from '#lib/toast.svelte.js';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Toggle from '#lib/components/Toggle.svelte';
	import type { UserSettings } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const s = $derived(data.user!.settings);

	async function set(patch: Partial<UserSettings>) {
		try {
			await api('/api/me/settings', 'PATCH', patch);
			await invalidateAll();
		} catch (e) {
			toast((e as Error).message, 'error');
		}
	}

	const themes = [
		{ id: 'system', label: 'Use device settings' },
		{ id: 'light', label: 'Light' },
		{ id: 'dark', label: 'Dark' }
	] as const;
	const weekStarts = [
		{ id: 0, label: 'Sunday' },
		{ id: 1, label: 'Monday' },
		{ id: 6, label: 'Saturday' }
	] as const;
	const zones =
		typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
</script>

<svelte:head><title>Appearance</title></svelte:head>

<PageHeader title="Appearance" back="/more" />

<main class="mx-auto max-w-xl pb-12">
	<p class="section-title">Color scheme</p>
	<div class="divide-y divide-border border-y border-border bg-surface">
		{#each themes as t (t.id)}
			<button class="list-row" onclick={() => set({ theme: t.id })}>
				<span class="flex-1">{t.label}</span>
				{#if (s.theme ?? 'system') === t.id}<Check size={18} class="text-accent" />{/if}
			</button>
		{/each}
	</div>

	<p class="section-title">Calendar</p>
	<div class="divide-y divide-border border-y border-border bg-surface">
		<label class="list-row">
			<span class="flex-1">Week starts on</span>
			<select
				class="rounded-lg border-border bg-surface py-1 text-sm"
				value={s.weekStart ?? 0}
				onchange={(e) => set({ weekStart: Number(e.currentTarget.value) as 0 | 1 | 6 })}
			>
				{#each weekStarts as w (w.id)}<option value={w.id}>{w.label}</option>{/each}
			</select>
		</label>
		<div class="list-row">
			<span class="flex-1">Show Saturdays in blue</span>
			<Toggle
				label="Show Saturdays in blue"
				checked={s.saturdayBlue ?? true}
				onchange={(v) => set({ saturdayBlue: v })}
			/>
		</div>
	</div>

	<p class="section-title">Time zone</p>
	<div class="divide-y divide-border border-y border-border bg-surface">
		<div class="list-row">
			<span class="flex-1">
				<span class="block">Follow this device</span>
				<span class="text-xs text-muted">Currently {deviceTimeZone().replace(/_/g, ' ')}</span>
			</span>
			<Toggle
				label="Follow device time zone"
				checked={!s.timeZone}
				onchange={(v) => set({ timeZone: v ? null : deviceTimeZone() })}
			/>
		</div>
		{#if s.timeZone}
			<label class="list-row">
				<span class="flex-1">Time zone</span>
				<select
					class="max-w-56 rounded-lg border-border bg-surface py-1 text-sm"
					value={s.timeZone}
					onchange={(e) => set({ timeZone: e.currentTarget.value })}
				>
					{#each zones as z (z)}<option value={z}>{z.replace(/_/g, ' ')}</option>{/each}
				</select>
			</label>
		{/if}
	</div>

	<p class="section-title">Maps</p>
	<div class="divide-y divide-border border-y border-border bg-surface">
		{#each [{ id: 'google', label: 'Google Maps' }, { id: 'apple', label: 'Apple Maps' }] as const as m (m.id)}
			<button class="list-row" onclick={() => set({ mapApp: m.id })}>
				<span class="flex-1">{m.label}</span>
				{#if (s.mapApp ?? 'google') === m.id}<Check size={18} class="text-accent" />{/if}
			</button>
		{/each}
	</div>
</main>
