<script lang="ts" module>
	import type { ListingDetail } from '$lib/listing';

	// Detail responses are cached for the session (module-level, so it survives the drawer
	// closing) — reopening a listing is instant.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- plain lookup, never rendered
	const cache = new Map<string, ListingDetail>();
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { Affordability } from '$lib/affordability';
	import {
		formatViewing,
		LISTING_STATUSES,
		STATUS_LABELS,
		type ListingStatus,
		type Viewing
	} from '$lib/listing';
	import ImageCarousel from './ImageCarousel.svelte';

	interface DrawerListing {
		finnkode: string;
		heading: string;
		address: string | null;
		district: string | null;
		url: string;
		imageUrl: string | null;
		priceTotal: number | null;
		priceSuggestion: number | null;
		sharedCost: number | null;
		sizeM2: number | null;
		pricePerM2: number | null;
		bedrooms: number | null;
		rooms: number | null;
		propertyType: string | null;
		travelMinutes: number | null;
		afford: Affordability | null;
		upcoming: Viewing[];
		status: ListingStatus | null;
		note: string | null;
		favorite: boolean;
		active: boolean;
	}

	let {
		listing,
		interestRate,
		onclose
	}: { listing: DrawerListing; interestRate: number; onclose: () => void } = $props();

	// Raw: replaced wholesale, never mutated — and keeps object identity stable for the carousel
	let detail: ListingDetail | null = $state.raw(null);
	let loadError = $state(false);
	let showFullDescription = $state(false);
	let panel: HTMLDivElement | undefined = $state();
	let carousel: ImageCarousel | undefined = $state();

	$effect(() => {
		const key = listing.finnkode;
		showFullDescription = false;
		loadError = false;
		// Read the cache into a local — reading `detail` here would make this effect depend on
		// the state it writes, and loop
		const cached = cache.get(key) ?? null;
		detail = cached;
		if (cached) return;
		const ctrl = new AbortController();
		fetch(resolve('/api/listing/[finnkode]', { finnkode: key }), { signal: ctrl.signal })
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
			.then((d: ListingDetail) => {
				cache.set(key, d);
				detail = d;
			})
			.catch((e) => {
				if (e.name !== 'AbortError') loadError = true;
			});
		return () => ctrl.abort();
	});

	// Lock page scroll behind the drawer and move focus into it
	$effect(() => {
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		panel?.focus();
		return () => {
			document.body.style.overflow = prev;
		};
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
		else if (!(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement))
			if (carousel?.handleKey(e)) e.preventDefault();
	}

	const keepValues: SubmitFunction =
		() =>
		async ({ update }) =>
			update({ reset: false });

	function submitOnChange(e: Event) {
		(e.currentTarget as HTMLElement).closest('form')?.requestSubmit();
	}

	const nf = (n: number) => n.toLocaleString('no-NO');
	const price = $derived(listing.priceTotal ?? listing.priceSuggestion);
	const dateFmt = new Intl.DateTimeFormat('nb-NO', {
		timeZone: 'Europe/Oslo',
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	// Only rows where the price actually moved (history is also seeded on first sight)
	const priceChanges = $derived.by(() => {
		const h = detail?.history ?? [];
		return h
			.map((p, i) => ({ ...p, diff: i === 0 ? null : p.price - h[i - 1].price }))
			.filter((p, i) => i === 0 || p.diff !== 0);
	});

	const DESCRIPTION_PREVIEW = 600;
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Above Leaflet's panes/controls (z-index up to 1000) -->
<div class="fixed inset-0 z-[2000] flex justify-end">
	<button
		type="button"
		class="absolute inset-0 cursor-default bg-black/40"
		onclick={onclose}
		aria-label="Lukk"
		tabindex="-1"
	></button>

	<div
		bind:this={panel}
		role="dialog"
		aria-modal="true"
		aria-label={listing.heading}
		tabindex="-1"
		class="relative flex h-full w-full flex-col bg-white shadow-2xl outline-none sm:max-w-2xl"
	>
		<div
			class="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-5"
		>
			<span class="truncate text-sm text-gray-500">
				{listing.address ?? ''}{listing.district ? ` · ${listing.district}` : ''}
			</span>
			<button
				type="button"
				onclick={onclose}
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl hover:bg-gray-100"
				aria-label="Lukk">✕</button
			>
		</div>

		<div class="flex-1 overflow-y-auto overscroll-contain">
			{#if detail && detail.images.length > 0}
				<ImageCarousel bind:this={carousel} images={detail.images} />
			{:else if listing.imageUrl}
				<div class="relative aspect-[4/3] bg-gray-900">
					<img src={listing.imageUrl} alt="" class="h-full w-full object-contain opacity-80" />
					{#if !detail && !loadError}
						<span
							class="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
							>Henter bilder…</span
						>
					{/if}
				</div>
			{/if}

			<div class="space-y-6 px-4 pt-3 pb-8 sm:px-5">
				<section>
					<div class="flex items-start justify-between gap-3">
						<h2 class="text-lg leading-snug font-semibold">{listing.heading}</h2>
						{#if !listing.active}
							<span class="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-xs">borte fra Finn</span>
						{/if}
					</div>
					<div class="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
						<span class="text-2xl font-bold tabular-nums"
							>{price !== null ? `${nf(price)} kr` : '–'}</span
						>
						{#if listing.pricePerM2}
							<span class="text-sm text-gray-600">{nf(listing.pricePerM2)} kr/m²</span>
						{/if}
					</div>
					<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
						{#if listing.sizeM2}<span>{listing.sizeM2} m²</span>{/if}
						{#if listing.bedrooms !== null}
							<span>{listing.bedrooms} soverom{listing.rooms ? ` · ${listing.rooms} rom` : ''}</span
							>
						{/if}
						{#if listing.propertyType}<span>{listing.propertyType}</span>{/if}
						<span
							>🚇 {listing.travelMinutes !== null
								? `${listing.travelMinutes} min til jobb`
								: 'reisetid ukjent'}</span
						>
					</div>
					{#if listing.afford}
						<p class="mt-2 text-sm text-gray-600">
							Totalt/mnd @{interestRate}%:
							<strong class="text-gray-900">{nf(Math.round(listing.afford.totalMonthly))} kr</strong
							>
							({Math.round(listing.afford.pctOfNet * 100)}% av netto){#if listing.sharedCost}, inkl.
								felleskost {nf(listing.sharedCost)} kr{/if}
						</p>
						{#if listing.afford.reasons.length > 0}
							<p class="mt-1 text-xs text-amber-800">{listing.afford.reasons.join(' · ')}</p>
						{/if}
					{/if}
				</section>

				<section class="flex flex-wrap items-center gap-2">
					<a
						href={listing.url}
						target="_blank"
						rel="external noopener noreferrer"
						class="inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 font-medium text-white hover:bg-blue-700"
					>
						Se på Finn ↗
					</a>
					<form method="POST" action="?/favorite" use:enhance>
						<input type="hidden" name="finnkode" value={listing.finnkode} />
						<input type="hidden" name="favorite" value={String(!listing.favorite)} />
						<button
							type="submit"
							class="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-200 px-3 hover:bg-amber-50"
						>
							{listing.favorite ? '★ Favoritt' : '☆ Favoritt'}
						</button>
					</form>
					<form method="POST" action="?/track" use:enhance={keepValues}>
						<input type="hidden" name="finnkode" value={listing.finnkode} />
						<select
							name="status"
							value={listing.status ?? ''}
							onchange={submitOnChange}
							class="min-h-10 rounded-lg border border-gray-200 px-2 text-sm"
							aria-label="Status"
						>
							<option value="">— Ingen status —</option>
							{#each LISTING_STATUSES as s (s)}<option value={s}>{STATUS_LABELS[s]}</option>{/each}
						</select>
					</form>
				</section>

				{#if listing.upcoming.length > 0}
					<section>
						<h3 class="mb-2 text-sm font-semibold text-gray-800">Visning</h3>
						<ul class="space-y-1.5">
							{#each listing.upcoming as v (v.start)}
								<li
									class="flex items-center justify-between gap-3 rounded-lg bg-violet-50 px-3 py-2 text-sm"
								>
									<span class="font-medium text-violet-900">{formatViewing(v)}</span>
									{#if v.calendarUrl}
										<a
											href={v.calendarUrl}
											rel="external"
											class="text-xs text-blue-600 hover:underline">+ kalender</a
										>
									{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				<section>
					<h3 class="mb-2 text-sm font-semibold text-gray-800">Notat</h3>
					<form
						method="POST"
						action="?/track"
						use:enhance={keepValues}
						class="flex flex-col gap-1.5"
					>
						<input type="hidden" name="finnkode" value={listing.finnkode} />
						<textarea
							name="note"
							rows="3"
							value={listing.note ?? ''}
							placeholder="Inntrykk fra visning, spørsmål til megler, budfrist…"
							class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
						></textarea>
						<button
							type="submit"
							class="self-end rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
						>
							Lagre notat
						</button>
					</form>
				</section>

				{#if loadError}
					<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
						Klarte ikke å hente detaljer fra Finn akkurat nå.
					</p>
				{:else if !detail}
					<div class="space-y-2" aria-hidden="true">
						{#each [0, 1, 2, 3] as i (i)}<div
								class="h-4 animate-pulse rounded bg-gray-100"
							></div>{/each}
					</div>
				{:else}
					{#if detail.facts.length > 0}
						<section>
							<h3 class="mb-2 text-sm font-semibold text-gray-800">Nøkkelinfo</h3>
							<dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
								{#each detail.facts as f (f.label)}
									<div>
										<dt class="text-xs text-gray-500">{f.label}</dt>
										<dd class="font-medium">{f.value}</dd>
									</div>
								{/each}
							</dl>
						</section>
					{/if}

					{#if priceChanges.length > 1}
						<section>
							<h3 class="mb-2 text-sm font-semibold text-gray-800">Prishistorikk</h3>
							<ul class="divide-y divide-gray-100 text-sm tabular-nums">
								{#each priceChanges as p (p.at)}
									<li class="flex justify-between gap-3 py-1.5">
										<span class="text-gray-500">{dateFmt.format(new Date(p.at))}</span>
										<span>
											{nf(p.price)} kr
											{#if p.diff}
												<span class="ml-2 text-xs {p.diff < 0 ? 'text-green-700' : 'text-red-700'}">
													{p.diff > 0 ? '+' : '−'}{nf(Math.abs(p.diff))}
												</span>
											{/if}
										</span>
									</li>
								{/each}
							</ul>
						</section>
					{/if}

					{#if detail.facilities.length > 0}
						<section>
							<h3 class="mb-2 text-sm font-semibold text-gray-800">Fasiliteter</h3>
							<div class="flex flex-wrap gap-1.5">
								{#each detail.facilities as f (f)}
									<span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">{f}</span
									>
								{/each}
							</div>
						</section>
					{/if}

					{#if detail.description}
						{@const long = detail.description.length > DESCRIPTION_PREVIEW}
						<section>
							<h3 class="mb-2 text-sm font-semibold text-gray-800">Om boligen</h3>
							<p class="text-sm leading-relaxed whitespace-pre-line text-gray-700">
								{long && !showFullDescription
									? detail.description.slice(0, DESCRIPTION_PREVIEW).trimEnd() + '…'
									: detail.description}
							</p>
							{#if long}
								<button
									type="button"
									onclick={() => (showFullDescription = !showFullDescription)}
									class="mt-1 text-sm font-medium text-blue-600 hover:underline"
								>
									{showFullDescription ? 'Vis mindre' : 'Les mer'}
								</button>
							{/if}
						</section>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</div>
