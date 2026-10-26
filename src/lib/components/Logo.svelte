<script lang="ts">
	let { size = 40 }: { size?: number } = $props();
</script>

<!-- A rounded calendar tile with a small tree; original artwork for this app -->
<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
	<rect x="2" y="6" width="60" height="56" rx="14" fill="var(--accent)" />
	<rect x="2" y="6" width="60" height="16" rx="14" fill="var(--accent-strong)" />
	<rect x="2" y="16" width="60" height="6" fill="var(--accent-strong)" />
	<rect x="17" y="1" width="6" height="12" rx="3" fill="var(--accent-strong)" />
	<rect x="41" y="1" width="6" height="12" rx="3" fill="var(--accent-strong)" />
	<circle cx="32" cy="38" r="12" fill="#ffffff" opacity="0.95" />
	<rect x="30" y="44" width="4" height="12" rx="2" fill="#ffffff" opacity="0.95" />
</svg>
