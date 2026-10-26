<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Bell from '@lucide/svelte/icons/bell';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import LayoutList from '@lucide/svelte/icons/layout-list';
	import Menu from '@lucide/svelte/icons/menu';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import Toasts from '#lib/components/Toasts.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const path = $derived(page.url.pathname);
	// Full-screen flows (editors, settings pages, chat) hide the tab bar
	const showTabs = $derived(
		path === '/' ||
			/^\/c\/[^/]+$/.test(path) ||
			['/calendars', '/more', '/activity', '/memos'].includes(path)
	);
	const tabs = $derived([
		{
			href: lastCalendarHref(),
			label: 'Calendar',
			icon: CalendarDays,
			active: /^\/c\/[^/]+$/.test(path) || path === '/',
			badge: 0
		},
		{
			href: '/activity',
			label: 'Activity',
			icon: Bell,
			active: path === '/activity',
			badge: path === '/activity' ? 0 : data.unread.feed
		},
		{
			href: '/memos',
			label: 'Memo',
			icon: NotebookPen,
			active: path === '/memos',
			badge: path === '/memos' ? 0 : data.unread.memos
		},
		{
			href: '/calendars',
			label: 'Calendars',
			icon: LayoutList,
			active: path === '/calendars',
			badge: 0
		},
		{ href: '/more', label: 'More', icon: Menu, active: path === '/more', badge: 0 }
	]);

	function lastCalendarHref() {
		if (/^\/c\/[^/]+/.test(path)) return path.split('/').slice(0, 3).join('/');
		const m =
			typeof document !== 'undefined' ? document.cookie.match(/(?:^|; )lastCal=([^;]*)/) : null;
		return `/c/${m ? decodeURIComponent(m[1]) : 'all'}`;
	}

	// Live updates: refresh whatever the change touched, batched
	onMount(() => {
		let pending: string[] = [];
		let timer: ReturnType<typeof setTimeout> | null = null;
		const source = new EventSource('/api/stream');
		source.onmessage = (e) => {
			try {
				const msg = JSON.parse(e.data) as { kinds: string[] };
				for (const k of msg.kinds) if (!pending.includes(`app:${k}`)) pending.push(`app:${k}`);
			} catch {
				return;
			}
			timer ??= setTimeout(() => {
				timer = null;
				const deps = pending;
				pending = [];
				for (const dep of deps) invalidate(dep);
			}, 300);
		};
		return () => {
			source.close();
			if (timer) clearTimeout(timer);
		};
	});
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
						'relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
						tab.active ? 'text-accent' : 'text-muted'
					]}
					aria-current={tab.active ? 'page' : undefined}
				>
					<tab.icon size={22} strokeWidth={tab.active ? 2.4 : 1.8} />
					{tab.label}
					{#if tab.badge}
						<span
							class="absolute top-1 left-1/2 ml-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-bold text-white"
						>
							{tab.badge > 99 ? '99+' : tab.badge}
						</span>
					{/if}
				</a>
			{/each}
		</div>
	</nav>
{/if}

<Toasts />
