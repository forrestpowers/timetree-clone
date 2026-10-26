<script lang="ts">
	import Heart from '@lucide/svelte/icons/heart';
	import SmilePlus from '@lucide/svelte/icons/smile-plus';
	import Sheet from './Sheet.svelte';
	import type { ReactionSummary } from '#lib/types.js';

	let {
		reactions,
		ontoggle,
		nameOf,
		showLike = false,
		compact = false
	}: {
		reactions: ReactionSummary[];
		ontoggle: (emoji: string) => void;
		nameOf: (memberId: string) => string;
		/** Show a "Like" button even before anyone has liked */
		showLike?: boolean;
		compact?: boolean;
	} = $props();

	const EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🎉', '👀'];
	let palette = $state(false);
	const like = $derived(reactions.find((r) => r.emoji === '❤️'));
	const others = $derived(reactions.filter((r) => !(showLike && r.emoji === '❤️')));
	const who = (r: ReactionSummary) => r.memberIds.map(nameOf).join(', ');
</script>

<div class="flex flex-wrap items-center gap-1.5">
	{#if showLike}
		<button
			class={[
				'flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm',
				like?.mine ? 'border-danger/40 bg-danger/10 text-danger' : 'border-border text-muted'
			]}
			onclick={() => ontoggle('❤️')}
			title={like ? who(like) : 'Like'}
			aria-label={like?.mine ? 'Unlike' : 'Like'}
			aria-pressed={!!like?.mine}
		>
			<Heart size={15} fill={like?.mine ? 'currentColor' : 'none'} />
			{like ? like.count : 'Like'}
		</button>
	{/if}
	{#each others as r (r.emoji)}
		<button
			class={[
				'flex items-center gap-1 rounded-full border',
				compact ? 'px-1.5 py-0 text-xs' : 'px-2 py-0.5 text-sm',
				r.mine ? 'border-accent bg-accent-soft' : 'border-border'
			]}
			onclick={() => ontoggle(r.emoji)}
			title={who(r)}
			aria-pressed={r.mine}
		>
			{r.emoji} <span class="text-xs">{r.count}</span>
		</button>
	{/each}
	<button
		class={[
			'flex items-center rounded-full text-muted hover:bg-surface-2',
			compact ? 'p-0.5' : 'p-1'
		]}
		onclick={() => (palette = true)}
		aria-label="Add reaction"
	>
		<SmilePlus size={compact ? 15 : 18} />
	</button>
</div>

<Sheet bind:open={palette} title="Reactions">
	<div class="grid grid-cols-4 gap-2 px-4 pb-5">
		{#each EMOJIS as emoji (emoji)}
			{@const r = reactions.find((x) => x.emoji === emoji)}
			<button
				class={[
					'flex flex-col items-center gap-0.5 rounded-2xl py-3 text-3xl',
					r?.mine ? 'bg-accent-soft' : 'bg-surface-2'
				]}
				onclick={() => {
					palette = false;
					ontoggle(emoji);
				}}
			>
				{emoji}
				{#if r}<span class="text-[11px] text-muted">{r.count}</span>{/if}
			</button>
		{/each}
	</div>
</Sheet>
