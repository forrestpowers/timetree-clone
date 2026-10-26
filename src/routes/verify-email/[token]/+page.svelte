<script lang="ts">
	import Notice from '#lib/components/Notice.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Notice
	title={data.ok ? 'Email verified' : 'Link expired'}
	body={data.ok
		? 'Thanks! Your email address is confirmed.'
		: 'This verification link has expired or was already used. You can send a new one from Settings → Account.'}
	href="/"
	cta="Open calendar"
/>
