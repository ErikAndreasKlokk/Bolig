<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { FINN_COUNTIES } from '$lib/locations';
	import { locationName } from '$lib/search';

	// Submits as `location` fields (hidden inputs, so municipalities filtered out of view or
	// covered by a whole county are still sent correctly)
	let { initial }: { initial: string[] } = $props();

	const selected = new SvelteSet<string>(untrack(() => initial));
	let query = $state('');
	const q = $derived(query.trim().toLocaleLowerCase('nb'));

	function setCounty(code: string, on: boolean) {
		const county = FINN_COUNTIES.find((c) => c.code === code)!;
		// The whole county replaces any of its municipalities
		for (const m of county.children) selected.delete(m.code);
		if (on) selected.add(code);
		else selected.delete(code);
	}

	function setChild(code: string, on: boolean) {
		if (on) selected.add(code);
		else selected.delete(code);
	}

	const visible = $derived(
		FINN_COUNTIES.map((c) => {
			const countyHit = !q || c.name.toLocaleLowerCase('nb').includes(q);
			const children = countyHit
				? c.children
				: c.children.filter((m) => m.name.toLocaleLowerCase('nb').includes(q));
			const picked = c.children.filter((m) => selected.has(m.code)).length;
			return { ...c, children, countyHit, picked };
		}).filter((c) => c.countyHit || c.children.length > 0)
	);
</script>

{#each [...selected] as code (code)}<input type="hidden" name="location" value={code} />{/each}

<div class="space-y-3">
	{#if selected.size > 0}
		<ul class="flex flex-wrap gap-1.5" aria-label="Valgte områder">
			{#each [...selected] as code (code)}
				<li
					class="inline-flex items-center gap-1 rounded-full bg-blue-100 py-1 pr-1 pl-3 text-sm text-blue-900"
				>
					{locationName(code)}{code.startsWith('0.') ? ' (hele)' : ''}
					<button
						type="button"
						onclick={() => selected.delete(code)}
						class="flex h-6 w-6 items-center justify-center rounded-full hover:bg-blue-200"
						aria-label="Fjern {locationName(code)}">×</button
					>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-amber-800">Ingen områder valgt — da søker vi ikke etter noe.</p>
	{/if}

	<input
		type="search"
		bind:value={query}
		placeholder="Finn kommune eller bydel, f.eks. Drammen"
		aria-label="Filtrer områder"
		class="h-11 w-full rounded-lg border border-gray-300 px-3 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
	/>

	<div class="max-h-96 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
		{#each visible as c (c.code)}
			{@const whole = selected.has(c.code)}
			<details open={!!q || whole || c.picked > 0} class="group">
				<summary
					class="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 select-none hover:bg-gray-50"
				>
					<span class="font-medium text-gray-800">
						{c.name}
						{#if whole}<span class="ml-1 text-xs font-normal text-blue-700">hele fylket</span>
						{:else if c.picked > 0}<span class="ml-1 text-xs font-normal text-blue-700"
								>{c.picked} valgt</span
							>{/if}
					</span>
					<span class="text-xs text-gray-400 group-open:rotate-180">▾</span>
				</summary>
				<div class="space-y-2 px-3 pt-1 pb-3">
					<label class="flex items-center gap-2 text-sm font-medium">
						<input
							type="checkbox"
							checked={whole}
							onchange={(e) => setCounty(c.code, e.currentTarget.checked)}
						/>
						Hele {c.name}
					</label>
					{#if c.children.length > 0}
						<div class="grid grid-cols-1 gap-x-4 gap-y-1.5 pl-6 sm:grid-cols-2">
							{#each c.children as m (m.code)}
								<label class="flex items-center gap-2 text-sm {whole ? 'text-gray-400' : ''}">
									<input
										type="checkbox"
										checked={whole || selected.has(m.code)}
										disabled={whole}
										onchange={(e) => setChild(m.code, e.currentTarget.checked)}
									/>
									{m.name}
								</label>
							{/each}
						</div>
					{/if}
				</div>
			</details>
		{/each}
		{#if visible.length === 0}
			<p class="px-3 py-4 text-sm text-gray-500">Ingen områder heter «{query}».</p>
		{/if}
	</div>
</div>
