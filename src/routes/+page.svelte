<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatPrice(n: number | null): string {
		return n === null ? '–' : `${n.toLocaleString('no-NO')} kr`;
	}
</script>

<svelte:head>
	<title>Boligjakt — {data.listings.length} boliger</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8">
	<header class="mb-6 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold">Boligjakt 🏠</h1>
			<p class="mt-1 text-sm text-gray-500">
				3–5 mill. kr i Oslo og Bærum, sortert etter reisetid til Verkstedveien 1 (Skøyen)
			</p>
		</div>
		<nav class="flex gap-3 text-sm">
			<a
				href="?hidden={data.showHidden ? '0' : '1'}{data.showInactive ? '&inactive=1' : ''}"
				class="text-blue-600 hover:underline"
			>
				{data.showHidden ? 'Skjul skjulte' : 'Vis skjulte'}
			</a>
			<a
				href="?inactive={data.showInactive ? '0' : '1'}{data.showHidden ? '&hidden=1' : ''}"
				class="text-blue-600 hover:underline"
			>
				{data.showInactive ? 'Skjul solgte' : 'Vis solgte'}
			</a>
		</nav>
	</header>

	{#if data.listings.length === 0}
		<p class="py-16 text-center text-gray-500">
			Ingen boliger ennå — skraperen kjører hvert 30. minutt.
		</p>
	{/if}

	<ul class="space-y-4">
		{#each data.listings as l (l.finnkode)}
			<li
				class="flex gap-4 rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md
				{l.favorite ? 'border-amber-400' : 'border-gray-200'}
				{!l.active ? 'opacity-50' : ''}"
			>
				{#if l.imageUrl}
					<img
						src={l.imageUrl}
						alt={l.heading}
						class="h-28 w-40 shrink-0 rounded-lg object-cover"
						loading="lazy"
					/>
				{:else}
					<div class="flex h-28 w-40 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-3xl">
						🏢
					</div>
				{/if}

				<div class="min-w-0 flex-1">
					<a href={l.url} target="_blank" rel="noopener noreferrer" class="hover:underline">
						<h2 class="truncate font-semibold">{l.heading}</h2>
					</a>
					<p class="mt-0.5 truncate text-sm text-gray-500">
						{l.address ?? l.localArea ?? ''}
						{#if !l.active}<span class="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-xs">borte fra Finn</span>{/if}
					</p>

					<div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
						<span class="font-medium">{formatPrice(l.priceTotal)}</span>
						{#if l.sizeM2}<span>{l.sizeM2} m²</span>{/if}
						{#if l.bedrooms}<span>{l.bedrooms} soverom</span>{/if}
						{#if l.propertyType}<span class="text-gray-500">{l.propertyType}</span>{/if}
						<span class="font-medium {l.travelMinutes !== null && l.travelMinutes <= 30 ? 'text-green-600' : 'text-gray-700'}">
							🚇 {l.travelMinutes !== null ? `${l.travelMinutes} min` : 'ukjent'}
						</span>
					</div>
				</div>

				<div class="flex shrink-0 flex-col justify-center gap-2">
					<form method="POST" action="?/favorite" use:enhance>
						<input type="hidden" name="finnkode" value={l.finnkode} />
						<input type="hidden" name="favorite" value={String(!l.favorite)} />
						<button
							type="submit"
							class="rounded-lg border border-gray-200 px-2.5 py-1.5 text-lg hover:bg-amber-50"
							title={l.favorite ? 'Fjern favoritt' : 'Favoritt'}
						>
							{l.favorite ? '★' : '☆'}
						</button>
					</form>
					<form method="POST" action="?/hide" use:enhance>
						<input type="hidden" name="finnkode" value={l.finnkode} />
						<input type="hidden" name="hidden" value={String(!l.hidden)} />
						<button
							type="submit"
							class="rounded-lg border border-gray-200 px-2.5 py-1.5 text-lg hover:bg-gray-50"
							title={l.hidden ? 'Vis igjen' : 'Skjul'}
						>
							{l.hidden ? '👁' : '🙈'}
						</button>
					</form>
				</div>
			</li>
		{/each}
	</ul>
</div>
