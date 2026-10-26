<script lang="ts">
	let {
		checked = $bindable(false),
		label,
		name,
		disabled = false,
		onchange
	}: {
		checked?: boolean;
		label: string;
		name?: string;
		disabled?: boolean;
		onchange?: (v: boolean) => void;
	} = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-label={label}
	{disabled}
	class={[
		'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
		checked ? 'bg-accent' : 'bg-border'
	]}
	onclick={() => {
		checked = !checked;
		onchange?.(checked);
	}}
>
	<span
		class={[
			'inline-block size-6 rounded-full bg-white shadow transition-transform',
			checked ? 'translate-x-5.5' : 'translate-x-0.5'
		]}
	></span>
</button>
{#if name}<input type="hidden" {name} value={checked ? 'on' : ''} />{/if}
