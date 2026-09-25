<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { pushState, replaceState } from '$app/navigation';
	import ListingMap from '$lib/components/ListingMap.svelte';
	import ListingDrawer from '$lib/components/ListingDrawer.svelte';
	import { formatViewing, LISTING_STATUSES, STATUS_LABELS, type ListingStatus } from '$lib/listing';
	import type { SubmitFunction } from '@sveltejs/kit';
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

	function statusClass(s: ListingStatus | null): string {
		if (!s) return 'border-gray-200 text-gray-500';
		return {
			interessert: 'border-blue-300 bg-blue-50 text-blue-800',
			visning: 'border-violet-300 bg-violet-50 text-violet-800',
			budt: 'border-emerald-300 bg-emerald-50 text-emerald-800',
			avslatt: 'border-gray-300 bg-gray-100 text-gray-500'
		}[s];
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

	// Same query string, different view
	function viewHref(view: 'liste' | 'kart'): string {
		// Throwaway copy for building a link, not reactive state
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const p = new URLSearchParams(page.url.searchParams);
		if (view === 'kart') p.set('view', 'kart');
		else p.delete('view');
		const s = p.toString();
		return resolve('/') + (s ? `?${s}` : '');
	}

	// Keep the typed note after saving instead of resetting the form to its initial value
	const keepValues: SubmitFunction =
		() =>
		async ({ update }) =>
			update({ reset: false });

	function submitOnChange(e: Event) {
		(e.currentTarget as HTMLElement).closest('form')?.requestSubmit();
	}

	// Drawer state lives in shallow-routing history, so Back (or swipe-back on a phone) closes it
	function openListing(finnkode: string) {
		if (page.state.listing) replaceState('', { listing: finnkode });
		else pushState('', { listing: finnkode });
	}

	// Agenda entries can be filtered out of the list, so they carry their own listing
	const openListingData = $derived.by(() => {
		const k = page.state.listing;
		if (!k) return null;
		return (
			data.listings.find((l) => l.finnkode === k) ??
			data.agenda.find((a) => a.finnkode === k)?.listing ??
			null
		);
	});

	const f = $derived(data.filters);
	const activeFilterCount = $derived(
		Object.values(f).filter((v) => v !== null).length +
			Number(data.onlyAffordable) +
			Number(data.showHidden) +
			Number(data.showInactive)
	);

	const inputClass =
		'w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
</script>

<svelte:head>
	<title>Boligjakt — {data.listings.length} boliger</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
	<header class="mb-6 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold sm:text-3xl">Boligjakt 🏠</h1>
			<p class="mt-1 text-sm text-gray-500">
				3–5 mill. kr i Oslo og Bærum, reisetid til Verkstedveien 1 (Skøyen)
			</p>
		</div>
		<nav class="flex flex-wrap items-center gap-2 text-sm">
			<!-- viewHref() calls resolve() internally, which the rule cannot see through -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<div class="inline-flex overflow-hidden rounded-full border border-gray-300">
				<a
					href={viewHref('liste')}
					class="inline-flex min-h-10 items-center px-3.5 {data.view === 'liste'
						? 'bg-gray-800 text-white'
						: 'hover:bg-gray-50'}"
				>
					☰ Liste
				</a>
				<a
					href={viewHref('kart')}
					class="inline-flex min-h-10 items-center border-l border-gray-300 px-3.5 {data.view ===
					'kart'
						? 'bg-gray-800 text-white'
						: 'hover:bg-gray-50'}"
				>
					🗺 Kart
				</a>
			</div>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<a
				href={resolve('/innsikt')}
				class="inline-flex min-h-10 items-center rounded-full border border-gray-200 px-3.5 font-medium text-blue-600"
			>
				📊 Innsikt
			</a>
			<a
				href={resolve('/settings')}
				class="inline-flex min-h-10 items-center rounded-full border border-gray-200 px-3.5 font-medium text-blue-600"
			>
				⚙ Innstillinger
			</a>
		</nav>
	</header>

	<section class="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm sm:p-4">
		<div
			class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-gray-700 sm:flex sm:flex-wrap sm:gap-x-6 sm:gap-y-2"
		>
			<span>Brutto: <strong>{data.settings.grossIncome.toLocaleString('no-NO')} kr</strong></span>
			<span>Netto/mnd: <strong>{data.settings.netMonthly.toLocaleString('no-NO')} kr</strong></span>
			<span>Sparing: <strong>{data.settings.savings.toLocaleString('no-NO')} kr</strong></span>
			<span>Gave: <strong>{data.settings.parentalGift.toLocaleString('no-NO')} kr</strong></span>
			<span
				>Husholdning: <strong>{data.settings.combinedIncome.toLocaleString('no-NO')} kr</strong
				></span
			>
			<span
				>Rente: <strong>{data.settings.interestRate}% / {data.settings.stressRate}% stress</strong
				></span
			>
		</div>
	</section>

	{#if data.agenda.length > 0}
		<section class="mb-6 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
			<h2 class="mb-2 text-sm font-semibold text-violet-900">📅 Kommende visninger</h2>
			<ul class="space-y-1 text-sm">
				{#each data.agenda as a (a.finnkode + a.viewing.start)}
					<li class="flex flex-wrap items-baseline gap-x-3">
						<span class="w-40 shrink-0 font-medium text-violet-900">{formatViewing(a.viewing)}</span
						>
						<button
							type="button"
							onclick={() => openListing(a.finnkode)}
							class="min-w-0 cursor-pointer truncate text-left hover:underline"
						>
							{a.address ?? a.heading}
						</button>
						{#if a.status}
							<span class="text-xs text-violet-700">{STATUS_LABELS[a.status]}</span>
						{/if}
						{#if a.viewing.calendarUrl}
							<a
								href={a.viewing.calendarUrl}
								rel="external"
								class="text-xs text-blue-600 hover:underline">+ kalender</a
							>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<form method="GET" class="mb-6 rounded-xl border border-gray-200 bg-white p-4">
		{#if data.view === 'kart'}<input type="hidden" name="view" value="kart" />{/if}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			<label class="block text-xs text-gray-600">
				Område
				<select name="area" value={f.area ?? ''} onchange={submitOnChange} class={inputClass}>
					<option value="">Alle</option>
					{#each data.areas as a (a)}<option value={a}>{a}</option>{/each}
				</select>
			</label>
			<label class="block text-xs text-gray-600">
				Boligtype
				<select name="type" value={f.type ?? ''} onchange={submitOnChange} class={inputClass}>
					<option value="">Alle</option>
					{#each data.types as t (t)}<option value={t}>{t}</option>{/each}
				</select>
			</label>
			<label class="block text-xs text-gray-600">
				Status
				<select name="status" value={f.status ?? ''} onchange={submitOnChange} class={inputClass}>
					<option value="">Alle</option>
					<option value="aktiv">Alle jeg følger</option>
					{#each LISTING_STATUSES as s (s)}<option value={s}>{STATUS_LABELS[s]}</option>{/each}
				</select>
			</label>
			<label class="block text-xs text-gray-600">
				Sorter etter
				<select name="sort" value={data.sort} onchange={submitOnChange} class={inputClass}>
					{#each Object.entries(data.sorts) as [k, label] (k)}<option value={k}>{label}</option
						>{/each}
				</select>
			</label>
			<label class="block text-xs text-gray-600">
				Min. soverom
				<input
					type="number"
					name="minBedrooms"
					min="1"
					value={f.minBedrooms ?? ''}
					class={inputClass}
				/>
			</label>
			<label class="block text-xs text-gray-600">
				Min. m²
				<input type="number" name="minSize" min="1" value={f.minSize ?? ''} class={inputClass} />
			</label>
			<label class="block text-xs text-gray-600">
				Maks pris (kr)
				<input
					type="number"
					name="maxPrice"
					step="50000"
					value={f.maxPrice ?? ''}
					class={inputClass}
				/>
			</label>
			<label class="block text-xs text-gray-600">
				Maks felleskost/mnd
				<input
					type="number"
					name="maxShared"
					step="500"
					value={f.maxShared ?? ''}
					class={inputClass}
				/>
			</label>
			<label class="block text-xs text-gray-600">
				Maks reisetid (min)
				<input
					type="number"
					name="maxTravel"
					step="5"
					value={f.maxTravel ?? ''}
					class={inputClass}
				/>
			</label>
		</div>
		<div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
			<label class="inline-flex items-center gap-1.5">
				<input
					type="checkbox"
					name="affordable"
					value="1"
					checked={data.onlyAffordable}
					onchange={submitOnChange}
				/>
				Skjul over evne
			</label>
			<label class="inline-flex items-center gap-1.5">
				<input
					type="checkbox"
					name="hidden"
					value="1"
					checked={data.showHidden}
					onchange={submitOnChange}
				/>
				Vis skjulte
			</label>
			<label class="inline-flex items-center gap-1.5">
				<input
					type="checkbox"
					name="inactive"
					value="1"
					checked={data.showInactive}
					onchange={submitOnChange}
				/>
				Vis solgte
			</label>
			<span class="ml-auto flex items-center gap-3">
				<span class="text-gray-500">{data.listings.length} treff</span>
				{#if activeFilterCount > 0}
					<!-- resolve() + query string, which the rule cannot see through -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={resolve('/') + (data.view === 'kart' ? '?view=kart' : '')}
						class="text-blue-600 hover:underline">Nullstill</a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/if}
				<button
					type="submit"
					class="rounded-lg bg-blue-600 px-4 py-1.5 font-medium text-white hover:bg-blue-700"
				>
					Filtrer
				</button>
			</span>
		</div>
		<p class="mt-2 text-xs text-gray-400">
			Boliger der verdien er ukjent (f.eks. soverom før detaljene er hentet) slipper gjennom
			tallfiltrene.
		</p>
	</form>

	{#if data.view === 'kart'}
		<ListingMap listings={data.listings} onopen={openListing} />
	{:else}
		{#if data.listings.length === 0}
			<p class="py-16 text-center text-gray-500">Ingen boliger matcher filtrene.</p>
		{/if}

		<ul class="space-y-4">
			{#each data.listings as l (l.finnkode)}
				<li
					id="l-{l.finnkode}"
					class="flex scroll-mt-4 flex-col gap-3 rounded-xl border bg-white p-3 shadow-sm transition sm:flex-row sm:gap-4 sm:p-4 sm:hover:shadow-md
					{l.favorite ? 'border-amber-400' : 'border-gray-200'}
					{!l.active || l.status === 'avslatt' ? 'opacity-50' : ''}"
				>
					<button
						type="button"
						onclick={() => openListing(l.finnkode)}
						class="group relative shrink-0 cursor-pointer overflow-hidden rounded-lg"
						aria-label="Vis detaljer for {l.heading}"
					>
						{#if l.imageUrl}
							<img
								src={l.imageUrl}
								alt=""
								class="h-44 w-full object-cover transition group-hover:scale-105 sm:h-28 sm:w-40"
								loading="lazy"
							/>
						{:else}
							<div
								class="flex h-44 w-full items-center justify-center bg-gray-100 text-3xl sm:h-28 sm:w-40"
							>
								🏢
							</div>
						{/if}
					</button>

					<div class="min-w-0 flex-1">
						<div class="flex items-start justify-between gap-3">
							<button
								type="button"
								onclick={() => openListing(l.finnkode)}
								class="min-w-0 flex-1 cursor-pointer text-left hover:underline"
							>
								<h2 class="line-clamp-2 font-semibold sm:line-clamp-1">{l.heading}</h2>
							</button>
							<a
								href={l.url}
								target="_blank"
								rel="external noopener noreferrer"
								class="shrink-0 text-xs whitespace-nowrap text-gray-400 hover:text-blue-600"
								title="Åpne på Finn">Finn ↗</a
							>
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
							{#if l.district}<span class="text-gray-400"> · {l.district}</span>{/if}
							{#if !l.active}<span class="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-xs"
									>borte fra Finn</span
								>{/if}
						</p>

						<div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
							<span class="font-medium">{formatPrice(l.priceTotal)}</span>
							{#if l.sizeM2}<span>{l.sizeM2} m²</span>{/if}
							{#if l.pricePerM2}
								<span class="text-gray-600">{l.pricePerM2.toLocaleString('no-NO')} kr/m²</span>
							{/if}
							{#if l.bedrooms !== null}
								<span>{l.bedrooms} soverom{l.rooms ? ` (${l.rooms} rom)` : ''}</span>
							{/if}
							{#if l.propertyType}<span class="text-gray-500">{l.propertyType}</span>{/if}
							{#if l.sharedCost}
								<span class="text-gray-600"
									>Felles {l.sharedCost.toLocaleString('no-NO')} kr/mnd</span
								>
							{/if}
							<span
								class="font-medium {l.travelMinutes !== null && l.travelMinutes <= 30
									? 'text-green-600'
									: 'text-gray-700'}"
							>
								🚇 {l.travelMinutes !== null ? `${l.travelMinutes} min` : 'ukjent'}
							</span>
							{#if l.priceHistory.length >= 2}
								{@const trend = priceTrend(l.priceHistory)}
								<span
									class="inline-flex items-center gap-1.5"
									title="Prisutvikling siden først sett"
								>
									<svg
										viewBox="0 0 120 28"
										class="h-7 w-[120px] {trendColor(trend.dir)}"
										preserveAspectRatio="none"
									>
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
								<span title="Lånekostnad + felleskostnader">
									Totalt/mnd @{data.settings.interestRate}%:
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

						{#if l.upcoming.length > 0}
							<div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
								<span class="text-gray-500">Visning:</span>
								{#each l.upcoming as v (v.start)}
									<a
										href={v.calendarUrl}
										rel="external"
										class="rounded-full bg-violet-50 px-2 py-0.5 text-violet-800 ring-1 ring-violet-200 ring-inset hover:bg-violet-100"
										title="Legg til i kalender"
									>
										{formatViewing(v)}
									</a>
								{/each}
							</div>
						{/if}

						<div class="mt-3 flex flex-wrap items-start gap-2">
							<form method="POST" action="?/track" use:enhance={keepValues}>
								<input type="hidden" name="finnkode" value={l.finnkode} />
								<select
									name="status"
									value={l.status ?? ''}
									onchange={submitOnChange}
									class="rounded-lg border px-2 py-1 text-xs {statusClass(l.status)}"
									aria-label="Status"
								>
									<option value="">— Ingen status —</option>
									{#each LISTING_STATUSES as s (s)}<option value={s}>{STATUS_LABELS[s]}</option
										>{/each}
								</select>
							</form>
							<details class="min-w-0 flex-1 text-xs">
								<summary class="cursor-pointer py-1 text-gray-500 select-none hover:text-gray-800">
									{#if l.note}📝 <span class="text-gray-700 italic">{l.note}</span>{:else}+ Notat{/if}
								</summary>
								<form
									method="POST"
									action="?/track"
									use:enhance={keepValues}
									class="mt-1 flex flex-col gap-1.5"
								>
									<input type="hidden" name="finnkode" value={l.finnkode} />
									<textarea
										name="note"
										rows="3"
										value={l.note ?? ''}
										placeholder="Inntrykk fra visning, spørsmål til megler, budfrist…"
										class="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
									></textarea>
									<button
										type="submit"
										class="self-end rounded-lg bg-gray-800 px-3 py-1 text-white hover:bg-gray-700"
									>
										Lagre notat
									</button>
								</form>
							</details>
						</div>
					</div>

					<div
						class="flex shrink-0 gap-2 border-t border-gray-100 pt-3 sm:flex-col sm:justify-center sm:border-0 sm:pt-0"
					>
						<form method="POST" action="?/favorite" use:enhance class="flex-1 sm:flex-none">
							<input type="hidden" name="finnkode" value={l.finnkode} />
							<input type="hidden" name="favorite" value={String(!l.favorite)} />
							<button
								type="submit"
								class="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 text-lg hover:bg-amber-50 sm:w-11 sm:gap-0"
								title={l.favorite ? 'Fjern favoritt' : 'Favoritt'}
							>
								{l.favorite ? '★' : '☆'}
								<span class="text-sm sm:hidden">Favoritt</span>
							</button>
						</form>
						<form method="POST" action="?/hide" use:enhance class="flex-1 sm:flex-none">
							<input type="hidden" name="finnkode" value={l.finnkode} />
							<input type="hidden" name="hidden" value={String(!l.hidden)} />
							<button
								type="submit"
								class="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 text-lg hover:bg-gray-50 sm:w-11 sm:gap-0"
								title={l.hidden ? 'Vis igjen' : 'Skjul'}
							>
								{l.hidden ? '👁' : '🙈'}
								<span class="text-sm sm:hidden">{l.hidden ? 'Vis igjen' : 'Skjul'}</span>
							</button>
						</form>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if openListingData}
	<ListingDrawer
		listing={openListingData}
		interestRate={data.settings.interestRate}
		onclose={() => history.back()}
	/>
{/if}
