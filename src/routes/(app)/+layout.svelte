<script lang="ts">
	import { page } from '$app/state';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import LayoutList from '@lucide/svelte/icons/layout-list';
	import Menu from '@lucide/svelte/icons/menu';
	import Toasts from '#lib/components/Toasts.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const path = $derived(page.url.pathname);
	// Full-screen flows (editors, settings pages) hide the tab bar
	const showTabs = $derived(
		path === '/' || /^\/c\/[^/]+$/.test(path) || path === '/calendars' || path === '/more'
	);
	const tabs = $derived([
		{
			href: lastCalendarHref(),
			label: 'Calendar',
			icon: CalendarDays,
			active: path.startsWith('/c/') || path === '/'
		},
		{ href: '/calendars', label: 'Calendars', icon: LayoutList, active: path === '/calendars' },
		{ href: '/more', label: 'More', icon: Menu, active: path === '/more' }
	]);

	function lastCalendarHref() {
		if (path.startsWith('/c/')) return path.split('/').slice(0, 3).join('/');
		const m =
			typeof document !== 'undefined' ? document.cookie.match(/(?:^|; )lastCal=([^;]*)/) : null;
		return `/c/${m ? decodeURIComponent(m[1]) : 'all'}`;
	}
</script>

<div class={['min-h-dvh', showTabs && 'pb-[calc(env(safe-area-inset-bottom)+3.5rem)]']}>
	{@render children()}
</div>

{#if showTabs}
	<nav
		class="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur"
	>
		<div class="mx-auto flex h-14 max-w-xl">
			{#each tabs as tab (tab.label)}
				<a
					href={tab.href}
					class={[
						'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
						tab.active ? 'text-accent' : 'text-muted'
					]}
					aria-current={tab.active ? 'page' : undefined}
				>
					<tab.icon size={22} strokeWidth={tab.active ? 2.4 : 1.8} />
					{tab.label}
				</a>
			{/each}
		</div>
	</nav>
{/if}

<Toasts />
