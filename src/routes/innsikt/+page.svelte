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

	type District = (typeof data.districts)[number];
	type SortKey = Exclude<keyof District, 'name'> | 'name';
	const COLUMNS: { key: SortKey; label: () => string }[] = [
		{ key: 'name', label: () => 'Område' },
		{ key: 'active', label: () => 'Aktive' },
		{ key: 'removed', label: () => `Borte (${data.recentDays} d)` },
		{ key: 'medianDays', label: () => 'Median dager' },
		{ key: 'medianPpmActive', label: () => 'Kr/m² aktive' },
		{ key: 'medianPpmRemoved', label: () => 'Kr/m² borte' },
		{ key: 'dropShare', label: () => 'Med prisfall' }
	];

	// Server order (most listings first) until a column header is clicked
	let sortKey: SortKey | null = $state(null);
	let sortDesc = $state(true);

	function sortBy(key: SortKey) {
		if (sortKey === key) sortDesc = !sortDesc;
		else {
			sortKey = key;
			// Names read naturally A→Z; numbers are most interesting biggest-first
			sortDesc = key !== 'name';
		}
	}

	const districts = $derived.by(() => {
		const k = sortKey;
		if (!k) return data.districts;
		const dir = sortDesc ? -1 : 1;
		return [...data.districts].sort((a, b) => {
			const va = a[k];
			const vb = b[k];
			// Unknown values last regardless of direction
			if (va === null) return vb === null ? 0 : 1;
			if (vb === null) return -1;
			if (typeof va === 'string') return dir * va.localeCompare(vb as string, 'nb');
			return dir * ((va as number) - (vb as number));
		});
	});

	// Bars scale against the most expensive area, so cheap and pricey areas stand out
	const maxPpm = $derived(
		Math.max(1, ...data.districts.flatMap((d) => [d.medianPpmActive ?? 0, d.medianPpmRemoved ?? 0]))
	);
	const barWidth = (v: number | null) => (v === null ? '0%' : `${(v / maxPpm) * 100}%`);
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
						{#each COLUMNS as c (c.key)}
							<th
								class="px-3 py-2 font-medium {c.key === 'name' ? '' : 'text-right'}"
								aria-sort={sortKey === c.key ? (sortDesc ? 'descending' : 'ascending') : 'none'}
							>
								<button
									type="button"
									onclick={() => sortBy(c.key)}
									class="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap hover:text-gray-900 {sortKey ===
									c.key
										? 'text-gray-900'
										: ''}"
								>
									{c.label()}
									<span class="w-2 text-[10px]"
										>{sortKey === c.key ? (sortDesc ? '▼' : '▲') : ''}</span
									>
								</button>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 tabular-nums">
					{#each districts as d (d.name)}
						<tr class="hover:bg-gray-50">
							<td class="px-3 py-2">
								{#if d.name === 'Ukjent område'}
									<span class="text-gray-500">{d.name}</span>
								{:else}
									<a
										href="{resolve('/')}?area={encodeURIComponent(d.name)}"
										class="text-blue-700 hover:underline">{d.name}</a
									>
								{/if}
							</td>
							<td class="px-3 py-2 text-right">{d.active}</td>
							<td class="px-3 py-2 text-right">{d.removed}</td>
							<td class="px-3 py-2 text-right">{nf(d.medianDays)}</td>
							{#each [d.medianPpmActive, d.medianPpmRemoved] as v, i (i)}
								<td class="min-w-32 px-3 py-2 text-right">
									<div class="relative">
										<div
											class="absolute inset-y-0 right-0 rounded {i === 0
												? 'bg-blue-100'
												: 'bg-gray-100'}"
											style="width:{barWidth(v)}"
										></div>
										<span class="relative px-1">{nf(v)}</span>
									</div>
								</td>
							{/each}
							<td class="px-3 py-2 text-right">{Math.round(d.dropShare * 100)}%</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="mt-2 text-xs text-gray-400">
			Tallene gjelder boligene ditt eget søk har funnet. «Borte» betyr at annonsen forsvant fra Finn
			— oftest solgt, men kan også være trukket eller prisjustert ut av søket. Boliger som lå ute
			før søket ditt startet er holdt utenfor median dager (vi vet ikke når de ble lagt ut). Område
			hentes fra annonsen, så nye boliger kan stå med poststed til detaljene er hentet.
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
