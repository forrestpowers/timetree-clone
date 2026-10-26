<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { formatDistanceToNow } from 'date-fns';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import SendHorizontal from '@lucide/svelte/icons/send-horizontal';
	import X from '@lucide/svelte/icons/x';
	import { api } from '#lib/api.js';
	import { toast } from '#lib/toast.svelte.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import ImageUpload from '#lib/components/ImageUpload.svelte';
	import ReactionBar from '#lib/components/ReactionBar.svelte';
	import type { ClientMember, ReactionSummary } from '#lib/types.js';

	type Comment = {
		id: string;
		memberId: string | null;
		body: string;
		fileIds: string[];
		createdAt: number;
		editedAt: number | null;
		reactions: ReactionSummary[];
	};

	let {
		eventId,
		calendarId,
		comments,
		members,
		isOwner
	}: {
		eventId: string;
		calendarId: string;
		comments: Comment[];
		members: ClientMember[];
		isOwner: boolean;
	} = $props();

	const memberById = $derived(new Map(members.map((m) => [m.id, m])));
	const nameOf = (id: string) => memberById.get(id)?.name ?? 'A former member';
	const refresh = () => invalidate('app:event');

	async function react(commentId: string, emoji: string) {
		try {
			await api('/api/reactions', 'POST', { targetType: 'comment', targetId: commentId, emoji });
			await refresh();
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}

	let draft = $state('');
	let draftImages = $state<string[]>([]);
	let posting = $state(false);
	async function post() {
		if (!draft.trim() && !draftImages.length) return;
		posting = true;
		try {
			await api(`/api/events/${eventId}/comments`, 'POST', { body: draft, fileIds: draftImages });
			draft = '';
			draftImages = [];
			await refresh();
			requestAnimationFrame(() =>
				document.getElementById('comments-end')?.scrollIntoView({ behavior: 'smooth' })
			);
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			posting = false;
		}
	}

	let editing = $state<{ id: string; body: string } | null>(null);
	async function saveEdit() {
		if (!editing) return;
		try {
			await api(`/api/events/${eventId}/comments/${editing.id}`, 'PATCH', { body: editing.body });
			editing = null;
			await refresh();
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}
	async function remove(id: string) {
		if (!confirm('Delete this comment?')) return;
		try {
			await api(`/api/events/${eventId}/comments/${id}`, 'DELETE');
			await refresh();
		} catch (err) {
			toast((err as Error).message, 'error');
		}
	}
</script>

<p class="section-title flex items-center gap-1.5">
	<MessageCircle size={14} /> Comments{comments.length ? ` (${comments.length})` : ''}
</p>
<div class="border-y border-border bg-surface">
	{#if !comments.length}
		<p class="px-4 py-5 text-center text-sm text-muted">
			No comments yet. Ask a question or share a photo.
		</p>
	{/if}
	{#each comments as c (c.id)}
		{@const author = c.memberId ? memberById.get(c.memberId) : null}
		<div class="flex gap-3 border-b border-border px-4 py-3 last:border-b-0">
			<Avatar name={author?.name ?? '?'} fileId={author?.avatarFileId} size={32} />
			<div class="min-w-0 flex-1">
				<p class="flex items-baseline gap-2 text-sm">
					<span class="font-semibold">{author?.name ?? 'A former member'}</span>
					<span class="text-xs text-muted"
						>{formatDistanceToNow(c.createdAt, { addSuffix: true })}{c.editedAt
							? ' · edited'
							: ''}</span
					>
				</p>
				{#if editing?.id === c.id}
					<textarea class="field mt-1 text-sm" rows="3" maxlength="2000" bind:value={editing.body}
					></textarea>
					<div class="mt-1 flex justify-end gap-2">
						<button class="btn btn-ghost !px-3 !py-1 text-sm" onclick={() => (editing = null)}
							>Cancel</button
						>
						<button class="btn btn-primary !px-3 !py-1 text-sm" onclick={saveEdit}>Save</button>
					</div>
				{:else if c.body}
					<p class="mt-0.5 text-[15px] break-words whitespace-pre-wrap">{c.body}</p>
				{/if}
				{#if c.fileIds.length}
					<div class="mt-2 grid grid-cols-2 gap-1.5">
						{#each c.fileIds as id (id)}
							<a href="/files/{id}" target="_blank" rel="noopener"
								><img
									src="/files/{id}"
									alt=""
									class="aspect-square w-full rounded-xl object-cover"
								/></a
							>
						{/each}
					</div>
				{/if}
				<div class="mt-1.5 flex items-center gap-3">
					<ReactionBar
						compact
						reactions={c.reactions}
						{nameOf}
						ontoggle={(emoji) => react(c.id, emoji)}
					/>
					{#if author?.isMe && editing?.id !== c.id}
						<button
							class="text-xs text-muted"
							onclick={() => (editing = { id: c.id, body: c.body })}>Edit</button
						>
					{/if}
					{#if author?.isMe || isOwner}
						<button class="text-xs text-muted" onclick={() => remove(c.id)}>Delete</button>
					{/if}
				</div>
			</div>
		</div>
	{/each}
	<div id="comments-end"></div>
</div>

<form
	class="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur"
	onsubmit={(ev) => {
		ev.preventDefault();
		post();
	}}
>
	{#if draftImages.length}
		<div class="flex gap-2 px-3 pt-2">
			{#each draftImages as id (id)}
				<div class="relative">
					<img src="/files/{id}" alt="" class="size-14 rounded-lg object-cover" />
					<button
						type="button"
						class="absolute -top-1.5 -right-1.5 rounded-full bg-text p-0.5 text-bg"
						onclick={() => (draftImages = draftImages.filter((x) => x !== id))}
						aria-label="Remove image"><X size={12} /></button
					>
				</div>
			{/each}
		</div>
	{/if}
	<div class="mx-auto flex max-w-xl items-end gap-2 p-2">
		{#if draftImages.length < 4}
			<ImageUpload
				kind="comment"
				{calendarId}
				maxSize={1600}
				onuploaded={(id) => {
					draftImages = [...draftImages, id];
				}}
				class="icon-btn shrink-0 text-muted"
			>
				{#snippet children({ busy })}<ImagePlus
						size={22}
						class={busy ? 'animate-pulse' : ''}
					/>{/snippet}
			</ImageUpload>
		{/if}
		<textarea
			class="field max-h-32 min-h-10 flex-1 resize-none !rounded-2xl !py-2 text-[15px]"
			rows="1"
			placeholder="Add a comment"
			maxlength="2000"
			bind:value={draft}
			onkeydown={(ev) => {
				if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) post();
			}}></textarea>
		<button
			class="icon-btn shrink-0 bg-accent text-on-accent disabled:opacity-40"
			disabled={posting || (!draft.trim() && !draftImages.length)}
			aria-label="Send comment"><SendHorizontal size={20} /></button
		>
	</div>
</form>
