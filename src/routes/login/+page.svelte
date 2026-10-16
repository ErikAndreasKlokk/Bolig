<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// After a wrong password, keep the person who was picked
	let selected = $state<string | null>(null);
	$effect(() => {
		if (form?.user) selected = form.user;
	});
</script>

<svelte:head>
	<title>Logg inn — Boligjakt</title>
</svelte:head>

<div class="flex min-h-dvh items-center justify-center px-4 py-10">
	<form
		method="POST"
		action="?/login"
		use:enhance
		class="w-full max-w-sm space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
	>
		<h1 class="text-2xl font-bold">Boligjakt 🏠</h1>

		{#if !data.configured}
			<p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
				Innlogging er ikke satt opp (APP_PASSWORD mangler på serveren).
			</p>
		{/if}

		<input type="hidden" name="next" value={page.url.searchParams.get('next') ?? ''} />

		<fieldset>
			<legend class="mb-2 text-sm text-gray-700">Hvem er du?</legend>
			<div class="grid grid-cols-3 gap-2">
				{#each data.users as u (u.key)}
					<label
						class="flex h-12 cursor-pointer items-center justify-center rounded-lg border font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 {selected ===
						u.key
							? 'border-blue-600 bg-blue-600 text-white'
							: 'border-gray-300 hover:bg-gray-50'}"
					>
						<input type="radio" name="user" value={u.key} bind:group={selected} class="sr-only" />
						{u.name}
					</label>
				{/each}
			</div>
		</fieldset>

		<label class="block text-sm">
			<span class="text-gray-700">Passord</span>
			<input
				type="password"
				name="password"
				autocomplete="current-password"
				required
				class="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
			/>
		</label>

		{#if form?.error}
			<p class="text-sm text-red-700" role="alert">{form.error}</p>
		{/if}

		<button
			type="submit"
			disabled={!selected}
			class="h-11 w-full rounded-lg bg-blue-600 font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50"
		>
			Logg inn
		</button>
	</form>
</div>
