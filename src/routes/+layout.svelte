<script lang="ts">
	import './layout.css';
	import { APP_NAME } from '$app/env/public';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Mirror the theme preference into a cookie so the first paint matches
	$effect(() => {
		const theme = data.user?.settings.theme ?? 'system';
		if (theme === 'system') {
			delete document.documentElement.dataset.theme;
			document.cookie = 'theme=; path=/; max-age=0';
		} else {
			document.documentElement.dataset.theme = theme;
			document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=lax`;
		}
	});
</script>

<svelte:head>
	<title>{APP_NAME}</title>
	<meta name="apple-mobile-web-app-title" content={APP_NAME} />
</svelte:head>

{@render children()}
