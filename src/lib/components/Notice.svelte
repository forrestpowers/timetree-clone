<script lang="ts">
	import Logo from './Logo.svelte';

	let { title, body, href, cta }: { title: string; body: string; href: string; cta: string } =
		$props();
</script>

<svelte:head><title>{title}</title></svelte:head>

<main class="pt-safe mx-auto flex min-h-dvh max-w-md flex-col items-center px-6 pt-20 text-center">
	<Logo size={56} />
	<h1 class="mt-6 text-xl font-bold">{title}</h1>
	<p class="mt-2 text-muted">{body}</p>
	<a class="btn btn-primary mt-8 w-full" {href}>{cta}</a>
</main>
