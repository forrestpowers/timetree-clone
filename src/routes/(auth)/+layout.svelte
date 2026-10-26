<script lang="ts">
	import { APP_NAME } from '$app/env/public';
	import Logo from '#lib/components/Logo.svelte';

	let { children } = $props();
</script>

<main class="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col px-5">
	<div class="flex flex-col items-center gap-3 pt-14 pb-8">
		<Logo size={56} />
		<h1 class="text-2xl font-bold tracking-tight">{APP_NAME}</h1>
	</div>
	{@render children()}
</main>
