<script lang="ts">
	import Check from '@lucide/svelte/icons/check';

	let { password, confirm }: { password: string; confirm: string } = $props();

	const kinds = $derived(
		[/[a-zA-Z]/, /\d/, /[^a-zA-Z\d]/].filter((re) => re.test(password)).length
	);
	const checks = $derived([
		{ ok: password.length >= 8 && password.length <= 64, text: '8–64 characters' },
		{ ok: kinds >= 2, text: 'Two of: letters, numbers, symbols' },
		{ ok: password.length >= 12 && kinds >= 3, text: 'Strong password' },
		{ ok: password.length > 0 && password === confirm, text: 'Passwords match' }
	]);
</script>

<ul class="flex flex-col gap-1 text-xs">
	{#each checks as check (check.text)}
		<li class={['flex items-center gap-1.5', check.ok ? 'text-accent' : 'text-muted']}>
			<Check size={14} strokeWidth={check.ok ? 3 : 1.5} />
			{check.text}
		</li>
	{/each}
</ul>
