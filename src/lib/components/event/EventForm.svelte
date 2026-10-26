<script lang="ts">
	import { untrack } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import Bell from '@lucide/svelte/icons/bell';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import Check from '@lucide/svelte/icons/check';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Clock from '@lucide/svelte/icons/clock';
	import Globe from '@lucide/svelte/icons/globe';
	import Link from '@lucide/svelte/icons/link';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import StickyNote from '@lucide/svelte/icons/sticky-note';
	import Tag from '@lucide/svelte/icons/tag';
	import Users from '@lucide/svelte/icons/users';
	import Repeat from '@lucide/svelte/icons/repeat';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { describeRepeat, isRecurring } from '#lib/recurrence.js';
	import { fileSize } from '#lib/event-format.js';
	import RepeatPicker from './RepeatPicker.svelte';
	import { api } from '#lib/api.js';
	import { dateToUtcMs, timeOf, utcMsToDate, dayKey, zonedToUtc, DAY_MS } from '#lib/dates.js';
	import { ALL_DAY_ALERTS, TIMED_ALERTS, alertLabel, VIRTUAL_PRESETS } from '#lib/meta.js';
	import { colorName, textOn } from '#lib/palette.js';
	import { toast } from '#lib/toast.svelte.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Toggle from '#lib/components/Toggle.svelte';
	import type {
		Attendee,
		ClientCalendar,
		ClientEvent,
		DayCount,
		EventFile,
		ClientLabel,
		ClientMember,
		ClientVirtualMember
	} from '#lib/types.js';

	let {
		event = null,
		calendars,
		labels,
		members,
		virtualMembers,
		initialCalendarId,
		initialDate,
		tz,
		occurrenceStartAt = null,
		initialTitle = ''
	}: {
		event?: ClientEvent | null;
		/** When editing one occurrence of a repeating event, its original start */
		occurrenceStartAt?: number | null;
		initialTitle?: string;
		calendars: ClientCalendar[];
		labels: ClientLabel[];
		members: ClientMember[];
		virtualMembers: ClientVirtualMember[];
		initialCalendarId: string;
		initialDate: string;
		tz: string;
	} = $props();

	function defaultTimes(date: string): [string, string] {
		const now = new Date();
		const todayLocal = dayKey(Date.now(), tz);
		if (date === todayLocal) {
			const hour = Math.min(22, Number(timeOf(now.getTime(), tz).slice(0, 2)) + 1);
			const pad = (n: number) => String(n).padStart(2, '0');
			return [`${pad(hour)}:00`, `${pad(hour + 1)}:00`];
		}
		return ['09:00', '10:00'];
	}

	// ---- form state, initialised from the event being edited or sensible defaults ----
	const init = untrack(() => {
		if (event && event.startAt != null) {
			const eventTz = event.allDay ? tz : event.startTz;
			return {
				calendarId: event.calendarId,
				title: event.title,
				allDay: event.allDay,
				startDate: event.allDay ? utcMsToDate(event.startAt) : dayKey(event.startAt, eventTz),
				endDate: event.allDay
					? utcMsToDate(event.endAt ?? event.startAt)
					: dayKey(event.endAt ?? event.startAt, event.endTz),
				startTime: event.allDay ? '09:00' : timeOf(event.startAt, eventTz),
				endTime: event.allDay ? '10:00' : timeOf(event.endAt ?? event.startAt, event.endTz),
				eventTz: event.allDay ? tz : event.startTz,
				labelId: event.labelId,
				attendees: event.attendees,
				alerts: event.alerts,
				locationName: event.locationName,
				url: event.url,
				note: event.note,
				recurrence: event.recurrence,
				checklist: event.checklist.map((c) => ({
					id: c.id as string | undefined,
					text: c.text,
					done: c.done
				})),
				files: event.files,
				dayCount: event.dayCount
			};
		}
		const cal = calendars.find((c) => c.id === initialCalendarId) ?? calendars[0];
		const [startTime, endTime] = defaultTimes(initialDate);
		const me = members.find((m) => m.calendarId === cal.id && m.isMe);
		const calLabels = labels.filter((l) => l.calendarId === cal.id);
		return {
			calendarId: cal.id,
			title: initialTitle.slice(0, 100),
			allDay: false,
			startDate: initialDate,
			endDate: initialDate,
			startTime,
			endTime,
			eventTz: tz,
			labelId:
				(cal.me.lastLabelId && calLabels.some((l) => l.id === cal.me.lastLabelId)
					? cal.me.lastLabelId
					: calLabels[0]?.id) ?? null,
			attendees: me ? [{ id: me.id, type: 'member' as const }] : [],
			alerts: [] as number[],
			locationName: '',
			url: '',
			note: '',
			recurrence: [] as string[],
			checklist: [] as { id?: string; text: string; done: boolean }[],
			files: [] as EventFile[],
			dayCount: null as DayCount | null
		};
	});

	let calendarId = $state(init.calendarId);
	let title = $state(init.title);
	let allDay = $state(init.allDay);
	let startDate = $state(init.startDate);
	let endDate = $state(init.endDate);
	let startTime = $state(init.startTime);
	let endTime = $state(init.endTime);
	let eventTz = $state(init.eventTz);
	let labelId = $state<string | null>(init.labelId);
	let attendees = $state<Attendee[]>(init.attendees);
	let alerts = $state<number[]>(init.alerts);
	let locationName = $state(init.locationName);
	let url = $state(init.url);
	let note = $state(init.note);
	let recurrence = $state<string[]>(init.recurrence);
	let checklist = $state(init.checklist);
	let attachedFiles = $state<EventFile[]>(init.files);
	let dayCount = $state<DayCount | null>(init.dayCount);
	let newItem = $state('');
	let uploading = $state(0);
	let saving = $state(false);
	let saved = false;

	const snapshot = () =>
		JSON.stringify([
			calendarId,
			title,
			allDay,
			startDate,
			endDate,
			startTime,
			endTime,
			eventTz,
			labelId,
			attendees,
			alerts,
			locationName,
			url,
			note,
			recurrence,
			checklist,
			attachedFiles.map((f) => f.id),
			dayCount
		]);
	const initialSnapshot = snapshot();

	const calLabels = $derived(labels.filter((l) => l.calendarId === calendarId));
	const calMembers = $derived(members.filter((m) => m.calendarId === calendarId));
	const calVirtual = $derived(virtualMembers.filter((v) => v.calendarId === calendarId));
	const label = $derived(calLabels.find((l) => l.id === labelId));
	const color = $derived(label?.color ?? '#9aa3a0');
	const calendar = $derived(calendars.find((c) => c.id === calendarId)!);
	const people = $derived(
		attendees
			.map((a) =>
				a.type === 'member'
					? calMembers.find((m) => m.id === a.id)
					: calVirtual.find((v) => v.id === a.id)
			)
			.filter((p) => !!p)
	);

	// Changing calendar resets the calendar-specific choices
	function switchCalendar(id: string) {
		if (id === calendarId) return;
		calendarId = id;
		const cal = calendars.find((c) => c.id === id)!;
		const ls = labels.filter((l) => l.calendarId === id);
		labelId =
			(cal.me.lastLabelId && ls.some((l) => l.id === cal.me.lastLabelId)
				? cal.me.lastLabelId
				: ls[0]?.id) ?? null;
		const me = members.find((m) => m.calendarId === id && m.isMe);
		attendees = me ? [{ id: me.id, type: 'member' }] : [];
	}

	// Moving the start keeps the duration
	let prevStart = { date: init.startDate, time: init.startTime };
	function onStartChange() {
		if (!startDate) return;
		const before = allDay
			? dateToUtcMs(prevStart.date)
			: zonedToUtc(prevStart.date, prevStart.time, eventTz);
		const after = allDay
			? dateToUtcMs(startDate)
			: zonedToUtc(startDate, startTime || '00:00', eventTz);
		const delta = after - before;
		if (allDay) {
			endDate = utcMsToDate(dateToUtcMs(endDate) + Math.round(delta / DAY_MS) * DAY_MS);
		} else {
			const end = zonedToUtc(endDate, endTime, eventTz) + delta;
			endDate = dayKey(end, eventTz);
			endTime = timeOf(end, eventTz);
		}
		prevStart = { date: startDate, time: startTime };
	}

	const invalidRange = $derived.by(() => {
		if (!startDate || !endDate) return true;
		if (allDay) return endDate < startDate;
		return (
			zonedToUtc(endDate, endTime || '00:00', eventTz) <
			zonedToUtc(startDate, startTime || '00:00', eventTz)
		);
	});

	// ---- sheets ----
	let open = $state<
		'calendar' | 'label' | 'attendees' | 'alerts' | 'tz' | 'repeat' | 'scope' | null
	>(null);
	const sheet = (name: typeof open) => () => (open = name);
	const zones =
		typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC'];
	let tzQuery = $state('');
	const filteredZones = $derived(
		zones
			.filter((z) => z.toLowerCase().includes(tzQuery.toLowerCase().replace(/\s+/g, '_')))
			.slice(0, 80)
	);

	function toggleAttendee(a: Attendee) {
		attendees = attendees.some((x) => x.id === a.id)
			? attendees.filter((x) => x.id !== a.id)
			: [...attendees, a];
	}
	function toggleAlert(m: number) {
		if (alerts.includes(m)) alerts = alerts.filter((x) => x !== m);
		else if (alerts.length < 10) alerts = [...alerts, m].sort((a, b) => a - b);
	}
	const alertPresets = $derived(allDay ? ALL_DAY_ALERTS : TIMED_ALERTS);

	// ---- checklist ----
	function addItem() {
		const text = newItem.trim();
		if (!text) return;
		if (checklist.length >= 100) return toast('No more items can be added.', 'error');
		checklist = [...checklist, { text: text.slice(0, 200), done: false }];
		newItem = '';
	}

	// ---- attachments ----
	const ACCEPT = '.pdf,.png,.jpg,.jpeg,.heic,.heif,.gif,.txt,.docx,.pptx,.xlsx';
	async function attach(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		for (const file of [...(input.files ?? [])]) {
			if (attachedFiles.length >= 10) {
				toast('Up to 10 files per event.', 'error');
				break;
			}
			if (file.size > 10 * 1024 * 1024) {
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
				attachedFiles = [
					...attachedFiles,
					{ id: res.id, name: res.name, size: res.size, mime: file.type }
				];
			} catch (err) {
				toast(`${file.name}: ${(err as Error).message}`, 'error');
			} finally {
				uploading--;
			}
		}
		input.value = '';
	}

	// ---- double-booking warning ----
	let conflicts = $state<{ attendeeId: string; title: string }[]>([]);
	$effect(() => {
		const ids = attendees.map((a) => a.id);
		if (allDay || invalidRange || !ids.length || !startDate || !endDate) {
			conflicts = [];
			return;
		}
		const body = {
			calendarId,
			attendeeIds: ids,
			startAt: zonedToUtc(startDate, startTime || '00:00', eventTz),
			endAt: zonedToUtc(endDate, endTime || '00:00', eventTz),
			excludeEventId: event?.id ?? null
		};
		const timer = setTimeout(() => {
			api<{ attendeeId: string; title: string }[]>('/api/events/conflicts', 'POST', body)
				.then((list) => (conflicts = list))
				.catch(() => (conflicts = []));
		}, 400);
		return () => clearTimeout(timer);
	});
	const conflictText = $derived.by(() => {
		const names = new Map([
			...calMembers.map((m) => [m.id, m.name] as const),
			...calVirtual.map((v) => [v.id, v.name] as const)
		]);
		const byPerson = Object.groupBy(conflicts, (c) => c.attendeeId);
		return Object.entries(byPerson).map(
			([id, list]) =>
				`${names.get(id) ?? 'Someone'} is attending ${[...new Set((list ?? []).map((c) => c.title))].join(', ')}`
		);
	});

	// ---- repeating events: ask what the edit applies to ----
	const editingOccurrence = $derived(!!event && isRecurring(event) && occurrenceStartAt != null);
	const ruleChanged = $derived(!!event && recurrence.join('\n') !== event.recurrence.join('\n'));
	function save() {
		if (!title.trim()) return toast('No title entered.', 'error');
		if (invalidRange)
			return toast('The start date/time must be before the end date/time.', 'error');
		if (uploading) return toast('Please save after the file is uploaded.', 'error');
		if (editingOccurrence) {
			open = 'scope';
			return;
		}
		return submit('all');
	}

	async function submit(scope: 'this' | 'future' | 'all') {
		open = null;
		saving = true;
		const body = {
			calendarId,
			title,
			allDay,
			startDate,
			endDate,
			startTime: allDay ? undefined : startTime,
			endTime: allDay ? undefined : endTime,
			startTz: eventTz,
			endTz: eventTz,
			locationName,
			url,
			note,
			labelId,
			attendees,
			alerts,
			recurrence,
			checklist,
			fileIds: attachedFiles.map((f) => f.id),
			dayCount,
			scope,
			occurrenceStartAt
		};
		try {
			const res = event
				? await api<{ id: string }>(`/api/events/${event.id}`, 'PUT', body)
				: await api<{ id: string }>('/api/events', 'POST', body);
			saved = true;
			const month = startDate.slice(0, 7);
			if (event) {
				// After "edit all" on an occurrence, reopen the occurrence at its new time
				const newStart = allDay
					? dateToUtcMs(startDate)
					: zonedToUtc(startDate, startTime, eventTz);
				const at =
					scope === 'all' && editingOccurrence && recurrence.length ? `?at=${newStart}` : '';
				goto(`/events/${res.id}${at}`, { replace: true, refreshAll: true });
			} else
				goto(`/c/${document.cookie.includes('lastCal=all') ? 'all' : calendarId}?month=${month}`, {
					replace: true,
					refreshAll: true
				});
			toast(event ? 'Event updated' : 'Event created');
		} catch (e) {
			toast((e as Error).message, 'error');
		} finally {
			saving = false;
		}
	}

	beforeNavigate(({ cancel, willUnload }) => {
		if (saved || snapshot() === initialSnapshot) return;
		if (willUnload) return cancel();
		if (!confirm('Are you sure you want to discard the information you have entered?')) cancel();
	});

	const tzLabel = (zone: string) => {
		try {
			const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
				.formatToParts(new Date())
				.find((p) => p.type === 'timeZoneName');
			return `${zone.replace(/_/g, ' ')} (${part?.value ?? ''})`;
		} catch {
			return zone;
		}
	};
	const presetEmoji = (p: string) => VIRTUAL_PRESETS.find((v) => v.id === p)?.emoji ?? '👤';
</script>

<PageHeader title={event ? 'Edit event' : 'New event'} back={() => history.back()} close>
	{#snippet actions()}
		<button class="btn btn-primary !px-4 !py-1.5" onclick={save} disabled={saving}>Save</button>
	{/snippet}
</PageHeader>

<main class="mx-auto max-w-xl pb-16">
	<div class="px-4 pt-4 pb-3" style:background="color-mix(in srgb, {color} 14%, var(--surface))">
		<!-- svelte-ignore a11y_autofocus -->
		<input
			class="w-full border-0 bg-transparent p-0 text-2xl font-bold placeholder:text-muted focus:ring-0"
			placeholder="Title"
			maxlength="100"
			autofocus={!event}
			bind:value={title}
		/>
	</div>

	<div class="divide-y divide-border border-y border-border bg-surface">
		{#if calendars.length > 1 && !event}
			<button class="list-row" onclick={sheet('calendar')}>
				<CalendarIcon size={20} class="text-muted" />
				<span class="flex-1 truncate">{calendar.name}</span>
				<ChevronRight size={18} class="text-muted" />
			</button>
		{/if}
		<button class="list-row" onclick={sheet('label')}>
			<Tag size={20} class="text-muted" />
			<span class="size-5 rounded-full" style:background={color}></span>
			<span class="flex-1 truncate">{label?.name || colorName(color)}</span>
			<ChevronRight size={18} class="text-muted" />
		</button>
	</div>

	<div class="mt-3 divide-y divide-border border-y border-border bg-surface">
		<div class="list-row">
			<Clock size={20} class="text-muted" />
			<span class="flex-1">All-day</span>
			<Toggle label="All-day" bind:checked={allDay} onchange={() => (alerts = [])} />
		</div>
		<div class="list-row">
			<span class="w-5"></span>
			<span class="w-14 text-muted">Starts</span>
			<input
				class="field !w-auto flex-1 !py-1.5"
				type="date"
				bind:value={startDate}
				onchange={onStartChange}
				required
			/>
			{#if !allDay}<input
					class="field !w-28 !py-1.5"
					type="time"
					bind:value={startTime}
					onchange={onStartChange}
					required
				/>{/if}
		</div>
		<div class="list-row">
			<span class="w-5"></span>
			<span class="w-14 text-muted">Ends</span>
			<input
				class={['field !w-auto flex-1 !py-1.5', invalidRange && '!border-danger']}
				type="date"
				bind:value={endDate}
				min={startDate}
				required
			/>
			{#if !allDay}<input
					class={['field !w-28 !py-1.5', invalidRange && '!border-danger']}
					type="time"
					bind:value={endTime}
					required
				/>{/if}
		</div>
		{#if !allDay}
			<button class="list-row" onclick={sheet('tz')}>
				<Globe size={20} class="text-muted" />
				<span class="flex-1 truncate text-sm">{tzLabel(eventTz)}</span>
				<ChevronRight size={18} class="text-muted" />
			</button>
		{/if}
		<button class="list-row" onclick={sheet('alerts')}>
			<Bell size={20} class="text-muted" />
			<span class="flex-1 truncate"
				>{alerts.length
					? alerts.map((m) => alertLabel(m, allDay)).join(', ')
					: 'No notification'}</span
			>
			<ChevronRight size={18} class="text-muted" />
		</button>
		<button class="list-row" onclick={sheet('repeat')}>
			<Repeat size={20} class="text-muted" />
			<span class={['flex-1 truncate', !recurrence.length && 'text-muted']}
				>{describeRepeat(recurrence, startDate)}</span
			>
			<ChevronRight size={18} class="text-muted" />
		</button>
		<div class="list-row">
			<Hourglass size={20} class="text-muted" />
			<span class="flex-1">Day counter</span>
			<Toggle
				label="Day counter"
				checked={!!dayCount}
				onchange={(v) => (dayCount = v ? { mode: 'until', interval: 'none' } : null)}
			/>
		</div>
		{#if dayCount}
			<div class="flex flex-wrap items-center gap-2 px-4 pb-3 pl-12 text-sm">
				<select class="rounded-lg border-border bg-surface py-1 text-sm" bind:value={dayCount.mode}>
					<option value="until">Count down to the day</option>
					<option value="since">Count up from the day</option>
				</select>
				<select
					class="rounded-lg border-border bg-surface py-1 text-sm"
					bind:value={dayCount.interval}
				>
					<option value="none">No reminders</option>
					<option value="weekly">Remind weekly</option>
					<option value="monthly">Remind monthly</option>
					<option value="yearly">Remind yearly</option>
					<option value="hundred_days">Every 100 days</option>
				</select>
			</div>
		{/if}
	</div>

	<div class="mt-3 divide-y divide-border border-y border-border bg-surface">
		<button class="list-row" onclick={sheet('attendees')}>
			<Users size={20} class="text-muted" />
			{#if people.length}
				<span class="flex flex-1 items-center -space-x-1.5">
					{#each people.slice(0, 6) as p (p.id)}<Avatar
							name={p.name}
							fileId={p.avatarFileId}
							size={26}
							ring
						/>{/each}
					{#if people.length > 6}<span class="pl-3 text-sm text-muted">+{people.length - 6}</span
						>{/if}
				</span>
			{:else}
				<span class="flex-1 text-muted">Members</span>
			{/if}
			<ChevronRight size={18} class="text-muted" />
		</button>
		{#if conflictText.length}
			<div
				class="flex gap-2 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400"
			>
				<TriangleAlert size={16} class="mt-0.5 shrink-0" />
				<div>
					<p class="font-medium">A member is attending another event</p>
					{#each conflictText as line (line)}<p class="text-xs">{line}</p>{/each}
				</div>
			</div>
		{/if}
		<label class="list-row">
			<MapPin size={20} class="text-muted" />
			<input
				class="min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0"
				placeholder="Location"
				maxlength="200"
				bind:value={locationName}
			/>
		</label>
		<label class="list-row">
			<Link size={20} class="text-muted" />
			<input
				class="min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0"
				placeholder="URL"
				type="url"
				inputmode="url"
				maxlength="2000"
				bind:value={url}
			/>
		</label>
		<label class="list-row items-start">
			<StickyNote size={20} class="mt-0.5 text-muted" />
			<textarea
				class="min-h-24 min-w-0 flex-1 resize-y border-0 bg-transparent p-0 focus:ring-0"
				placeholder="Note"
				maxlength="10000"
				bind:value={note}></textarea>
		</label>
	</div>

	<p class="section-title flex items-center gap-1.5"><ListChecks size={14} /> To-do list</p>
	<div class="divide-y divide-border border-y border-border bg-surface">
		{#each checklist as item, i (i)}
			<div class="flex items-center gap-3 px-4 py-2">
				<input
					type="checkbox"
					class="size-5 rounded text-accent"
					bind:checked={item.done}
					aria-label="Done"
				/>
				<input
					class={[
						'min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0',
						item.done && 'text-muted line-through'
					]}
					maxlength="200"
					bind:value={item.text}
				/>
				<button
					class="icon-btn size-8 text-muted"
					onclick={() => (checklist = checklist.filter((_, j) => j !== i))}
					aria-label="Remove item"><X size={16} /></button
				>
			</div>
		{/each}
		<form
			class="flex items-center gap-3 px-4 py-2"
			onsubmit={(e) => {
				e.preventDefault();
				addItem();
			}}
		>
			<Plus size={20} class="text-muted" />
			<input
				class="min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0"
				placeholder="Add an item"
				maxlength="200"
				bind:value={newItem}
				onblur={addItem}
			/>
		</form>
	</div>

	<p class="section-title flex items-center gap-1.5"><Paperclip size={14} /> Attachments</p>
	<div class="divide-y divide-border border-y border-border bg-surface">
		{#each attachedFiles as f (f.id)}
			<div class="flex items-center gap-3 px-4 py-2.5">
				<Paperclip size={18} class="shrink-0 text-muted" />
				<span class="min-w-0 flex-1 truncate">{f.name}</span>
				<span class="text-xs text-muted">{fileSize(f.size)}</span>
				<button
					class="icon-btn size-8 text-muted"
					onclick={() => (attachedFiles = attachedFiles.filter((x) => x.id !== f.id))}
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
</main>

<Sheet open={open === 'calendar'} onclose={() => (open = null)} title="Calendar">
	<div class="divide-y divide-border">
		{#each calendars as c (c.id)}
			<button
				class="list-row"
				onclick={() => {
					switchCalendar(c.id);
					open = null;
				}}
			>
				<span class="flex-1 text-left">{c.name}</span>
				{#if c.id === calendarId}<Check size={18} class="text-accent" />{/if}
			</button>
		{/each}
	</div>
</Sheet>

<Sheet open={open === 'label'} onclose={() => (open = null)} title="Label">
	<div class="divide-y divide-border">
		{#each calLabels as l (l.id)}
			<button
				class="list-row"
				onclick={() => {
					labelId = l.id;
					open = null;
				}}
			>
				<span
					class="flex size-7 items-center justify-center rounded-full"
					style:background={l.color}
					style:color={textOn(l.color)}
				>
					{#if l.id === labelId}<Check size={16} strokeWidth={3} />{/if}
				</span>
				<span class="flex-1 text-left">{l.name || colorName(l.color)}</span>
			</button>
		{/each}
	</div>
	<a href="/c/{calendarId}/labels" class="block p-4 text-center text-sm text-accent"
		>Event label management</a
	>
</Sheet>

<Sheet open={open === 'attendees'} onclose={() => (open = null)} title="Members">
	<div class="divide-y divide-border">
		{#each calMembers as m (m.id)}
			{@const on = attendees.some((a) => a.id === m.id)}
			<button class="list-row" onclick={() => toggleAttendee({ id: m.id, type: 'member' })}>
				<Avatar name={m.name} fileId={m.avatarFileId} size={32} />
				<span class="flex-1 text-left">{m.name}{m.isMe ? ' (me)' : ''}</span>
				<span
					class={[
						'flex size-6 items-center justify-center rounded-full border-2',
						on ? 'border-accent bg-accent text-on-accent' : 'border-border'
					]}
				>
					{#if on}<Check size={14} strokeWidth={3} />{/if}
				</span>
			</button>
		{/each}
		{#each calVirtual as v (v.id)}
			{@const on = attendees.some((a) => a.id === v.id)}
			<button class="list-row" onclick={() => toggleAttendee({ id: v.id, type: 'virtual' })}>
				{#if v.avatarFileId}<Avatar name={v.name} fileId={v.avatarFileId} size={32} />{:else}<span
						class="flex size-8 items-center justify-center rounded-full bg-surface-2"
						>{presetEmoji(v.preset)}</span
					>{/if}
				<span class="flex-1 text-left">{v.name}</span>
				<span
					class={[
						'flex size-6 items-center justify-center rounded-full border-2',
						on ? 'border-accent bg-accent text-on-accent' : 'border-border'
					]}
				>
					{#if on}<Check size={14} strokeWidth={3} />{/if}
				</span>
			</button>
		{/each}
	</div>
	{#snippet footer()}<button class="btn btn-primary w-full" onclick={() => (open = null)}
			>Done</button
		>{/snippet}
</Sheet>

<Sheet open={open === 'alerts'} onclose={() => (open = null)} title="Event notification">
	<div class="divide-y divide-border">
		<button class="list-row" onclick={() => (alerts = [])}>
			<span class="flex-1 text-left">No notification</span>
			{#if !alerts.length}<Check size={18} class="text-accent" />{/if}
		</button>
		{#each alertPresets as m (m)}
			<button class="list-row" onclick={() => toggleAlert(m)}>
				<span class="flex-1 text-left">{alertLabel(m, allDay)}</span>
				{#if alerts.includes(m)}<Check size={18} class="text-accent" />{/if}
			</button>
		{/each}
	</div>
	{#snippet footer()}<button class="btn btn-primary w-full" onclick={() => (open = null)}
			>Done</button
		>{/snippet}
</Sheet>

<Sheet open={open === 'repeat'} onclose={() => (open = null)} title="Repeat">
	<RepeatPicker
		{recurrence}
		{startDate}
		onchange={(lines) => {
			recurrence = lines;
			open = null;
		}}
	/>
</Sheet>

<Sheet open={open === 'scope'} onclose={() => (open = null)} title="This is a repeating event">
	<p class="px-5 pb-3 text-sm text-muted">Which events should this change apply to?</p>
	<div class="divide-y divide-border border-t border-border">
		{#if !ruleChanged}
			<button class="list-row" onclick={() => submit('this')}>Edit this event only</button>
		{/if}
		<button class="list-row" onclick={() => submit('future')}>Edit this and future events</button>
		<button class="list-row" onclick={() => submit('all')}>Edit all repeating events</button>
	</div>
</Sheet>

<Sheet open={open === 'tz'} onclose={() => (open = null)} title="Time zone">
	<div class="px-4 pb-2">
		<input class="field" placeholder="Search time zones" bind:value={tzQuery} />
	</div>
	<div class="divide-y divide-border">
		{#each filteredZones as zone (zone)}
			<button
				class="list-row text-sm"
				onclick={() => {
					eventTz = zone;
					open = null;
				}}
			>
				<span class="flex-1 text-left">{tzLabel(zone)}</span>
				{#if zone === eventTz}<Check size={18} class="text-accent" />{/if}
			</button>
		{/each}
	</div>
</Sheet>
