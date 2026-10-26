<script lang="ts">
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { api } from '#lib/api.js';
	import { fileSize } from '#lib/event-format.js';
	import { toast } from '#lib/toast.svelte.js';
	import type { EventFile } from '#lib/types.js';

	let {
		files = $bindable(),
		uploading = $bindable(0),
		calendarId
	}: { files: EventFile[]; uploading?: number; calendarId: string } = $props();

	const ACCEPT = '.pdf,.png,.jpg,.jpeg,.heic,.heif,.gif,.txt,.docx,.pptx,.xlsx';
	const MAX_FILES = 10;
	const MAX_BYTES = 10 * 1024 * 1024;

	async function attach(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		for (const file of [...(input.files ?? [])]) {
			if (files.length >= MAX_FILES) {
				toast(`Up to ${MAX_FILES} files.`, 'error');
				break;
			}
			if (file.size > MAX_BYTES) {
				toast(`${file.name}: the file size exceeds the 10MB limit.`, 'error');
				continue;
			}
			uploading++;
			try {
				const form = new FormData();
				form.set('file', file);
				form.set('calendarId', calendarId);
				const res = await api<{ id: string; name: string; size: number }>(
					'/api/events/attachments',
					'POST',
					form
				);
				files = [...files, { id: res.id, name: res.name, size: res.size, mime: file.type }];
			} catch (err) {
				toast(`${file.name}: ${(err as Error).message}`, 'error');
			} finally {
				uploading--;
			}
		}
		input.value = '';
	}
</script>

<p class="section-title flex items-center gap-1.5"><Paperclip size={14} /> Attachments</p>
<div class="divide-y divide-border border-y border-border bg-surface">
	{#each files as f (f.id)}
		<div class="flex items-center gap-3 px-4 py-2.5">
			<Paperclip size={18} class="shrink-0 text-muted" />
			<span class="min-w-0 flex-1 truncate">{f.name}</span>
			<span class="text-xs text-muted">{fileSize(f.size)}</span>
			<button
				class="icon-btn size-8 text-muted"
				onclick={() => (files = files.filter((x) => x.id !== f.id))}
				aria-label="Remove attachment"><X size={16} /></button
			>
		</div>
	{/each}
	<label class="list-row cursor-pointer text-accent">
		<Plus size={20} />
		{uploading ? 'Uploading…' : 'Attach files'}
		<input type="file" multiple accept={ACCEPT} class="hidden" onchange={attach} />
	</label>
</div>
<p class="px-4 pt-2 text-xs text-muted">PDF, images, text and Office files, up to 10 MB each.</p>
