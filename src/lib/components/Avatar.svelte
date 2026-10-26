<script lang="ts">
	let {
		name,
		fileId = null,
		size = 32,
		ring = false
	}: { name: string; fileId?: string | null; size?: number; ring?: boolean } = $props();

	const HUES = [152, 190, 205, 265, 330, 0, 28, 45, 95, 230];
	const hue = $derived(
		HUES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length]
	);
	const initials = $derived(
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((w) => [...w][0] ?? '')
			.join('')
			.toUpperCase() || '?'
	);
</script>

{#if fileId}
	<img
		src="/files/{fileId}"
		alt={name}
		width={size}
		height={size}
		class={['shrink-0 rounded-full object-cover', ring && 'ring-2 ring-surface']}
		style:width="{size}px"
		style:height="{size}px"
	/>
{:else}
	<span
		role="img"
		aria-label={name}
		class={[
			'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none',
			ring && 'ring-2 ring-surface'
		]}
		style:width="{size}px"
		style:height="{size}px"
		style:font-size="{Math.round(size * 0.4)}px"
		style:background="hsl({hue} 55% 48%)"
	>
		{initials}
	</span>
{/if}
