<script lang="ts">
	import Notice from '#lib/components/Notice.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Notice
	title={data.ok ? 'Your email address was changed' : 'Could not change email'}
	body={data.ok ? 'Use the new address the next time you log in.' : data.reason}
	href="/"
	cta="Open calendar"
/>
