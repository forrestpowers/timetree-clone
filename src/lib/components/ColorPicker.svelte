<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import { LABEL_COLORS, MATERIAL_COLORS, textOn } from '#lib/palette.js';

	let { value = $bindable(''), onpick }: { value?: string; onpick?: (hex: string) => void } =
		$props();

	const sections = [
		{ title: 'Calendar colors', colors: LABEL_COLORS },
		{ title: 'Material Design colors', colors: MATERIAL_COLORS }
	];
</script>

{#each sections as section (section.title)}
	<p class="section-title">{section.title}</p>
	<div class="grid grid-cols-5 gap-3 px-4 sm:grid-cols-8">
		{#each section.colors as color (color.hex)}
			{@const selected = value.toLowerCase() === color.hex.toLowerCase()}
			<button
				type="button"
				class="flex flex-col items-center gap-1"
				onclick={() => {
					value = color.hex;
					onpick?.(color.hex);
				}}
				aria-label={color.name}
				aria-pressed={selected}
			>
				<span
					class={[
						'flex size-11 items-center justify-center rounded-full',
						selected && 'ring-2 ring-text ring-offset-2 ring-offset-surface'
					]}
					style:background={color.hex}
					style:color={textOn(color.hex)}
				>
					{#if selected}<Check size={20} strokeWidth={3} />{/if}
				</span>
				<span class="line-clamp-1 text-[10px] text-muted">{color.name}</span>
			</button>
		{/each}
	</div>
{/each}
<div class="h-4"></div>
