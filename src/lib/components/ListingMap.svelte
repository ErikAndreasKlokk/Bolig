<script lang="ts">
	import { onMount } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import type { Map as LeafletMap } from 'leaflet';

	interface MapListing {
		finnkode: string;
		heading: string;
		address: string | null;
		lat: number | null;
		lon: number | null;
		url: string;
		imageUrl: string | null;
		travelMinutes: number | null;
		sizeM2: number | null;
		pricePerM2: number | null;
		priceTotal: number | null;
		priceSuggestion: number | null;
		favorite: boolean;
		active: boolean;
	}

	let { listings, onopen }: { listings: MapListing[]; onopen?: (finnkode: string) => void } =
		$props();

	// Verkstedveien 1, Skøyen — same point Entur routes to (see server/entur.ts)
	const WORK: [number, number] = [59.92152, 10.69847];

	const BUCKETS = [
		{ max: 20, color: '#16a34a', label: '≤ 20 min' },
		{ max: 30, color: '#65a30d', label: '21–30 min' },
		{ max: 45, color: '#d97706', label: '31–45 min' },
		{ max: Infinity, color: '#dc2626', label: '> 45 min' }
	];
	const UNKNOWN = '#9ca3af';

	function colorFor(minutes: number | null): string {
		if (minutes === null) return UNKNOWN;
		return BUCKETS.find((b) => minutes <= b.max)!.color;
	}

	function esc(s: string): string {
		return s.replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
		);
	}

	function popupHtml(l: MapListing): string {
		const price = l.priceTotal ?? l.priceSuggestion;
		const facts = [
			price !== null ? `${price.toLocaleString('no-NO')} kr` : null,
			l.sizeM2 ? `${l.sizeM2} m²` : null,
			l.pricePerM2 ? `${l.pricePerM2.toLocaleString('no-NO')} kr/m²` : null,
			l.travelMinutes !== null ? `🚇 ${l.travelMinutes} min` : null
		].filter(Boolean);
		return `
			<div style="width:220px">
				${l.imageUrl ? `<img src="${esc(l.imageUrl)}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:6px;margin-bottom:6px">` : ''}
				<a href="${esc(l.url)}" data-open="${esc(l.finnkode)}" style="font-weight:600;cursor:pointer">${l.favorite ? '★ ' : ''}${esc(l.heading)}</a>
				<div style="color:#6b7280;margin-top:2px">${esc(l.address ?? '')}</div>
				<div style="margin-top:4px">${facts.join(' · ')}</div>
				<div style="margin-top:6px;display:flex;gap:12px">
					<a href="#" data-open="${esc(l.finnkode)}">Vis detaljer</a>
					<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">Finn ↗</a>
				</div>
			</div>`;
	}

	let container: HTMLDivElement;
	let map: LeafletMap | undefined;
	let L: typeof import('leaflet') | undefined;
	let layer: import('leaflet').LayerGroup | undefined;

	function draw() {
		if (!map || !L || !layer) return;
		layer.clearLayers();
		const points: [number, number][] = [WORK];
		// Draw favorites last so they sit on top
		const sorted = [...listings].sort((a, b) => Number(a.favorite) - Number(b.favorite));
		for (const l of sorted) {
			if (l.lat === null || l.lon === null) continue;
			points.push([l.lat, l.lon]);
			L.circleMarker([l.lat, l.lon], {
				radius: l.favorite ? 9 : 7,
				color: l.favorite ? '#f59e0b' : '#ffffff',
				weight: l.favorite ? 3 : 1.5,
				fillColor: colorFor(l.travelMinutes),
				fillOpacity: l.active ? 0.9 : 0.35
			})
				.bindPopup(popupHtml(l))
				.addTo(layer);
		}
		if (points.length > 1)
			map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 14 });
	}

	onMount(() => {
		let cancelled = false;
		(async () => {
			L = await import('leaflet');
			if (cancelled) return;
			map = L.map(container).setView(WORK, 12);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; OpenStreetMap-bidragsytere'
			}).addTo(map);
			L.marker(WORK, {
				icon: L.divIcon({ html: '💼', className: '', iconSize: [24, 24], iconAnchor: [12, 12] })
			})
				.bindTooltip('Jobb — Verkstedveien 1')
				.addTo(map);
			layer = L.layerGroup().addTo(map);
			draw();
		})();
		return () => {
			cancelled = true;
			map?.remove();
		};
	});

	// Redraw when filters change the listing set
	$effect(() => {
		void listings;
		draw();
	});

	const missing = $derived(listings.filter((l) => l.lat === null || l.lon === null).length);
</script>

<div class="overflow-hidden rounded-xl border border-gray-200">
	<!-- Popups are Leaflet HTML strings, so catch their "open drawer" links by delegation -->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		bind:this={container}
		class="h-[70vh] min-h-[400px] w-full"
		onclick={(e) => {
			const link = (e.target as HTMLElement).closest<HTMLElement>('[data-open]');
			if (link && onopen) {
				e.preventDefault();
				onopen(link.dataset.open!);
			}
		}}
	></div>
</div>
<div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
	{#each BUCKETS as b (b.label)}
		<span class="inline-flex items-center gap-1.5">
			<span class="inline-block h-3 w-3 rounded-full" style="background:{b.color}"></span>{b.label}
		</span>
	{/each}
	<span class="inline-flex items-center gap-1.5">
		<span class="inline-block h-3 w-3 rounded-full" style="background:{UNKNOWN}"></span>ukjent
	</span>
	<span class="inline-flex items-center gap-1.5">
		<span class="inline-block h-3 w-3 rounded-full border-2 border-amber-500"></span>favoritt
	</span>
	{#if missing > 0}
		<span class="text-gray-400">{missing} uten koordinater vises ikke</span>
	{/if}
</div>
