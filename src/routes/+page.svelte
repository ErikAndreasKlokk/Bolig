<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatPrice(n: number | null): string {
		return n === null ? '–' : `${n.toLocaleString('no-NO')} kr`;
	}

	function badgeClass(level: 'green' | 'amber' | 'red'): string {
		return {
			green: 'bg-green-100 text-green-800 ring-green-300',
			amber: 'bg-amber-100 text-amber-800 ring-amber-300',
			red: 'bg-red-100 text-red-800 ring-red-300'
		}[level];
	}

	function badgeLabel(level: 'green' | 'amber' | 'red'): string {
		return { green: 'Innen budsjett', amber: 'Strakk', red: 'Over evne' }[level];
	}

	// Build SVG polyline points for a price sparkline (equal x-spacing, y normalized to range)
	function sparkPoints(history: number[], w = 120, h = 28): string {
		if (history.length < 2) return '';
		const min = Math.min(...history);
		const max = Math.max(...history);
		const range = max - min || 1;
		const n = history.length;
		return history
			.map((p, i) => {
				const x = (i / (n - 1)) * w;
				const y = h - ((p - min) / range) * h;
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	}

	function priceTrend(history: number[]): { dir: 'down' | 'up' | 'flat'; diff: number } {
		if (history.length < 2) return { dir: 'flat', diff: 0 };
		const diff = history[history.length - 1] - history[0];
		return { dir: diff < 0 ? 'down' : diff > 0 ? 'up' : 'flat', diff };
	}

	function trendColor(dir: 'down' | 'up' | 'flat'): string {
		return dir === 'down' ? 'text-green-600' : dir === 'up' ? 'text-red-600' : 'text-gray-400';
	}

	function flagQuery(key: string, on: boolean): string {
		const p = new URLSearchParams();
		if (data.showHidden && key !== 'hidden') p.set('hidden', '1');
		if (data.showInactive && key !== 'inactive') p.set('inactive', '1');
		if (data.onlyAffordable && key !== 'affordable') p.set('affordable', '1');
		if (on) p.set(key, '1');
		const s = p.toString();
		return s ? '?' + s : '?';
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
		<nav class="flex flex-wrap gap-3 text-sm">
			<a href="/settings" class="font-medium text-blue-600 hover:underline">⚙ Innstillinger</a>
			<a
				href={flagQuery('affordable', !data.onlyAffordable)}
				class="text-blue-600 hover:underline"
			>
				{data.onlyAffordable ? 'Vis alle' : 'Skjul over evne'}
			</a>
			<a href={flagQuery('hidden', !data.showHidden)} class="text-blue-600 hover:underline">
				{data.showHidden ? 'Skjul skjulte' : 'Vis skjulte'}
			</a>
			<a href={flagQuery('inactive', !data.showInactive)} class="text-blue-600 hover:underline">
				{data.showInactive ? 'Skjul solgte' : 'Vis solgte'}
			</a>
		</nav>
	</header>

	<section class="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
		<div class="flex flex-wrap gap-x-6 gap-y-2 text-gray-700">
			<span>Brutto: <strong>{data.settings.grossIncome.toLocaleString('no-NO')} kr</strong></span>
			<span>Netto/mnd: <strong>{data.settings.netMonthly.toLocaleString('no-NO')} kr</strong></span>
			<span>Sparing: <strong>{data.settings.savings.toLocaleString('no-NO')} kr</strong></span>
			<span>Gave: <strong>{data.settings.parentalGift.toLocaleString('no-NO')} kr</strong></span>
			<span>Husholdning: <strong>{data.settings.combinedIncome.toLocaleString('no-NO')} kr</strong></span>
			<span>Rente: <strong>{data.settings.interestRate}% / {data.settings.stressRate}% stress</strong></span>
		</div>
	</section>

	{#if data.listings.length === 0}
		<p class="py-16 text-center text-gray-500">
			Ingen boliger her — skraperen kjører hvert 30. minutt.
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
					<div class="flex items-start justify-between gap-3">
						<a href={l.url} target="_blank" rel="noopener noreferrer" class="hover:underline">
							<h2 class="truncate font-semibold">{l.heading}</h2>
						</a>
						{#if l.afford}
							<span
								class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset {badgeClass(
									l.afford.level
								)}"
								title={l.afford.reasons.join(' · ') || 'Komfortabelt innen budsjett'}
							>
								{badgeLabel(l.afford.level)}
							</span>
						{/if}
					</div>

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
						{#if l.priceHistory.length >= 2}
							{@const trend = priceTrend(l.priceHistory)}
							<span class="inline-flex items-center gap-1.5" title="Prisutvikling siden først sett">
								<svg viewBox="0 0 120 28" class="h-7 w-[120px] {trendColor(trend.dir)}" preserveAspectRatio="none">
									<polyline
										points={sparkPoints(l.priceHistory)}
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linejoin="round"
										stroke-linecap="round"
										vector-effect="non-scaling-stroke"
									/>
								</svg>
								{#if trend.dir !== 'flat'}
									<span class="text-xs font-medium {trendColor(trend.dir)}">
										{trend.dir === 'down' ? '↓' : '↑'}
										{Math.abs(trend.diff).toLocaleString('no-NO')} kr
									</span>
								{/if}
							</span>
						{/if}
					</div>

					{#if l.afford}
						<div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
							<span>
								Lån: <strong class="text-gray-800">{formatPrice(l.afford.loan)}</strong>
							</span>
							<span>
								Mnd @{data.settings.interestRate}%:
								<strong class="text-gray-800">
									{Math.round(l.afford.totalMonthly).toLocaleString('no-NO')} kr
								</strong>
								({Math.round(l.afford.pctOfNet * 100)}% av netto)
							</span>
							<span>
								@{data.settings.stressRate}%:
								<strong class="text-gray-800">
									{Math.round(l.afford.totalMonthlyStress).toLocaleString('no-NO')} kr
								</strong>
								({Math.round(l.afford.pctOfNetStress * 100)}%)
							</span>
							{#if l.afford.equityGap > 0}
								<span class="text-red-700">
									Mangler {l.afford.equityGap.toLocaleString('no-NO')} kr i egenkapital
								</span>
							{/if}
						</div>
					{/if}
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
