<script lang="ts">
	import type { Snippet } from 'svelte';
	import { api, resizeImage } from '#lib/api.js';
	import { toast } from '#lib/toast.svelte.js';

	let {
		kind,
		calendarId = null,
		maxSize = 1600,
		onuploaded,
		children,
		class: className = ''
	}: {
		kind: 'avatar' | 'cover' | 'background';
		calendarId?: string | null;
		maxSize?: number;
		onuploaded: (fileId: string) => void | Promise<void>;
		children: Snippet<[{ busy: boolean }]>;
		class?: string;
	} = $props();

	let input: HTMLInputElement;
	let busy = $state(false);

	async function pick(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		busy = true;
		try {
			const resized = await resizeImage(file, maxSize);
			const form = new FormData();
			form.set('file', resized);
			form.set('kind', kind);
			if (calendarId) form.set('calendarId', calendarId);
			const { id } = await api<{ id: string }>('/api/upload', 'POST', form);
			await onuploaded(id);
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			busy = false;
			input.value = '';
		}
	}
</script>

<button type="button" class={className} onclick={() => input.click()} disabled={busy}>
	{@render children({ busy })}
</button>
<input bind:this={input} type="file" accept="image/*" class="hidden" onchange={pick} />
