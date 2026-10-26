<script lang="ts">
	import EventForm from '#lib/components/event/EventForm.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>New event</title></svelte:head>

{#key data.initialCalendarId + data.initialDate}
	<EventForm
		calendars={data.calendars}
		labels={data.labels}
		members={data.members}
		virtualMembers={data.virtualMembers}
		initialCalendarId={data.initialCalendarId}
		initialDate={data.initialDate}
		initialTitle={data.initialTitle}
		tz={data.tz}
	/>
{/key}
