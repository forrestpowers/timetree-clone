<script lang="ts">
	import EventForm from '#lib/components/event/EventForm.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Edit event</title></svelte:head>

{#key data.event.id}
	<EventForm
		event={data.event}
		calendars={data.calendars}
		labels={data.labels}
		members={data.members}
		virtualMembers={data.virtualMembers}
		initialCalendarId={data.event.calendarId}
		initialDate=""
		tz={data.tz}
	/>
{/key}
