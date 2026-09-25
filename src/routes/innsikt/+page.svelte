<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const nf = (n: number | null, suffix = '') =>
		n === null ? '–' : `${n.toLocaleString('no-NO')}${suffix}`;

	const dateFmt = new Intl.DateTimeFormat('nb-NO', {
		timeZone: 'Europe/Oslo',
		day: 'numeric',
		month: 'short'
	});

	function changeClass(c: number | null): string {
		if (c === null || c === 0) return 'text-gray-400';
		return c < 0 ? 'text-green-700' : 'text-red-700';
	}
</script>

<svelte:head>
	<title>Innsikt — Boligjakt</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8">
	<header class="mb-6 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold">📊 Innsikt</h1>
			<p class="mt-1 text-sm text-gray-500">
				Hvor fort ting forsvinner fra Finn, og hva det koster per m², per område.
				{#if data.trackingStart}Data fra {dateFmt.format(data.trackingStart)}{/if}
			</p>
		</div>
		<a href={resolve('/')} class="text-sm text-blue-600 hover:underline">← Tilbake</a>
	</header>

	<section class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
		{#each [{ label: 'Aktive nå', value: nf(data.summary.active) }, { label: `Borte siste ${data.recentDays} d`, value: nf(data.summary.removed) }, { label: 'Median dager på Finn', value: nf(data.summary.medianDays, ' d') }, { label: 'Median kr/m² (aktive)', value: nf(data.summary.medianPpm) }] as tile (tile.label)}
			<div class="rounded-xl border border-gray-200 bg-white p-4">
				<div class="text-xs text-gray-500">{tile.label}</div>
				<div class="mt-1 text-2xl font-semibold tabular-nums">{tile.value}</div>
			</div>
		{/each}
	</section>

	<section class="mb-8">
		<h2 class="mb-2 font-semibold">Per område</h2>
		<div class="overflow-x-auto rounded-xl border border-gray-200 bg-white">
			<table class="w-full text-sm">
				<thead class="bg-gray-50 text-left text-xs text-gray-500">
					<tr>
						<th class="px-3 py-2 font-medium">Område</th>
						<th class="px-3 py-2 text-right font-medium">Aktive</th>
						<th class="px-3 py-2 text-right font-medium">Borte ({data.recentDays} d)</th>
						<th class="px-3 py-2 text-right font-medium">Median dager</th>
						<th class="px-3 py-2 text-right font-medium">Kr/m² aktive</th>
						<th class="px-3 py-2 text-right font-medium">Kr/m² borte</th>
						<th class="px-3 py-2 text-right font-medium">Med prisfall</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 tabular-nums">
					{#each data.districts as d (d.name)}
						<tr>
							<td class="px-3 py-2">
								<a href="{resolve('/')}?area={encodeURIComponent(d.name)}" class="hover:underline"
									>{d.name}</a
								>
							</td>
							<td class="px-3 py-2 text-right">{d.active}</td>
							<td class="px-3 py-2 text-right">{d.removed}</td>
							<td class="px-3 py-2 text-right">{nf(d.medianDays)}</td>
							<td class="px-3 py-2 text-right">{nf(d.medianPpmActive)}</td>
							<td class="px-3 py-2 text-right">{nf(d.medianPpmRemoved)}</td>
							<td class="px-3 py-2 text-right">{Math.round(d.dropShare * 100)}%</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="mt-2 text-xs text-gray-400">
			«Borte» betyr at annonsen forsvant fra søket — oftest solgt, men kan også være trukket eller
			prisjustert ut av 3–5 mill. Boliger som lå ute før skraperen startet er holdt utenfor median
			dager (vi vet ikke når de ble lagt ut). Område hentes fra annonsen, så eldre boliger kan stå
			som «Ukjent område» til detaljene er hentet.
		</p>
	</section>

	<section>
		<h2 class="mb-2 font-semibold">Nylig borte fra Finn</h2>
		{#if data.recent.length === 0}
			<p class="text-sm text-gray-500">Ingen enda.</p>
		{:else}
			<div class="overflow-x-auto rounded-xl border border-gray-200 bg-white">
				<table class="w-full text-sm">
					<thead class="bg-gray-50 text-left text-xs text-gray-500">
						<tr>
							<th class="px-3 py-2 font-medium">Bolig</th>
							<th class="px-3 py-2 font-medium">Område</th>
							<th class="px-3 py-2 text-right font-medium">Sist pris</th>
							<th class="px-3 py-2 text-right font-medium">Endring</th>
							<th class="px-3 py-2 text-right font-medium">Kr/m²</th>
							<th class="px-3 py-2 text-right font-medium">Dager</th>
							<th class="px-3 py-2 text-right font-medium">Borte</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 tabular-nums">
						{#each data.recent as l (l.finnkode)}
							<tr>
								<td class="max-w-64 truncate px-3 py-2">
									<a
										href={l.url}
										target="_blank"
										rel="external noopener noreferrer"
										class="hover:underline"
									>
										{l.favorite ? '★ ' : ''}{l.address ?? l.heading}
									</a>
								</td>
								<td class="px-3 py-2 text-gray-600">{l.district}</td>
								<td class="px-3 py-2 text-right">{nf(l.price)}</td>
								<td class="px-3 py-2 text-right {changeClass(l.priceChange)}">
									{l.priceChange ? (l.priceChange > 0 ? '+' : '') + nf(l.priceChange) : '–'}
								</td>
								<td class="px-3 py-2 text-right">{nf(l.pricePerM2)}</td>
								<td
									class="px-3 py-2 text-right"
									title={l.censored ? 'Lå ute før vi begynte å følge med' : ''}
								>
									{l.censored ? '≥' : ''}{l.daysOnMarket}
								</td>
								<td class="px-3 py-2 text-right text-gray-500">{dateFmt.format(l.lastSeenAt)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>
