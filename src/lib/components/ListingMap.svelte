<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import type { CircleMarker, Map as LeafletMap } from 'leaflet';

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

	let {
		listings,
		work = null,
		travelIcon = '🚇',
		highlight = null,
		onopen,
		heightClass = 'h-[70vh] min-h-[400px]'
	}: {
		listings: MapListing[];
		/** The user's work address — the point travel times are measured to */
		work?: { lat: number; lon: number; label: string } | null;
		travelIcon?: string;
		/** finnkode of the listing to emphasise (e.g. the card under the mouse) */
		highlight?: string | null;
		onopen?: (finnkode: string) => void;
		heightClass?: string;
	} = $props();

	// Read once at mount — the map is re-created on navigation anyway
	const WORK: [number, number] | null = untrack(() => (work ? [work.lat, work.lon] : null));
	// Fallback view (central Oslo) when there's no work address
	const CENTER: [number, number] = WORK ?? [59.9139, 10.7522];

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

	// Hover preview — clicking the marker opens the full listing dialog
	function tooltipHtml(l: MapListing): string {
		const price = l.priceTotal ?? l.priceSuggestion;
		const facts = [
			price !== null ? `${price.toLocaleString('no-NO')} kr` : null,
			l.sizeM2 ? `${l.sizeM2} m²` : null,
			l.travelMinutes !== null ? `${travelIcon} ${l.travelMinutes} min` : null
		].filter(Boolean);
		return `
			<div style="width:220px;white-space:normal">
				${l.imageUrl ? `<img src="${esc(l.imageUrl)}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:6px;margin-bottom:6px">` : ''}
				<div style="font-weight:600">${l.favorite ? '★ ' : ''}${esc(l.heading)}</div>
				<div style="color:#6b7280;margin-top:2px">${esc(l.address ?? '')}</div>
				<div style="margin-top:4px">${facts.join(' · ')}</div>
			</div>`;
	}

	function baseStyle(l: MapListing) {
		return {
			radius: l.favorite ? 9 : 7,
			color: l.favorite ? '#f59e0b' : '#ffffff',
			weight: l.favorite ? 3 : 1.5,
			fillColor: colorFor(l.travelMinutes),
			fillOpacity: l.active ? 0.9 : 0.35
		};
	}
	const HIGHLIGHT_STYLE = { radius: 12, color: '#1d4ed8', weight: 4, fillOpacity: 1 };

	let container: HTMLDivElement;
	let map: LeafletMap | undefined;
	let L: typeof import('leaflet') | undefined;
	let layer: import('leaflet').LayerGroup | undefined;
	// Plain registries (never rendered), rebuilt on every draw
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const markers = new Map<string, { marker: CircleMarker; listing: MapListing }>();
	let highlighted: string | null = null;
	// Only re-fit the view when the *set* of listings changes (new filters), not when a
	// favorite/status change reloads the same listings
	let fittedKey = '';
	let fittedBounds: import('leaflet').LatLngBounds | undefined;
	// Once the user pans/zooms, stop re-fitting on container resizes
	let userMoved = false;

	function applyHighlight(key: string | null) {
		const prev = highlighted ? markers.get(highlighted) : undefined;
		if (prev) {
			prev.marker.setStyle(baseStyle(prev.listing));
			prev.marker.closeTooltip();
		}
		highlighted = key;
		const next = key ? markers.get(key) : undefined;
		if (next) {
			next.marker.setStyle(HIGHLIGHT_STYLE).bringToFront().openTooltip();
		}
	}

	function draw() {
		if (!map || !L || !layer) return;
		layer.clearLayers();
		markers.clear();
		highlighted = null;
		const points: [number, number][] = WORK ? [WORK] : [];
		// Draw favorites last so they sit on top
		const sorted = [...listings].sort((a, b) => Number(a.favorite) - Number(b.favorite));
		for (const l of sorted) {
			if (l.lat === null || l.lon === null) continue;
			points.push([l.lat, l.lon]);
			const marker = L.circleMarker([l.lat, l.lon], baseStyle(l))
				.bindTooltip(tooltipHtml(l), { direction: 'top', offset: [0, -8] })
				.on('click', () => onopen?.(l.finnkode))
				.addTo(layer);
			markers.set(l.finnkode, { marker, listing: l });
		}
		const key = listings
			.map((l) => l.finnkode)
			.sort()
			.join(',');
		if (key !== fittedKey && points.length > 1) {
			fittedKey = key;
			fittedBounds = L.latLngBounds(points);
			userMoved = false;
			map.fitBounds(fittedBounds, { padding: [30, 30], maxZoom: 14 });
		}
		applyHighlight(untrack(() => highlight));
	}

	onMount(() => {
		let cancelled = false;
		(async () => {
			L = await import('leaflet');
			if (cancelled) return;
			map = L.map(container).setView(CENTER, 12);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; OpenStreetMap-bidragsytere'
			}).addTo(map);
			if (WORK && work) {
				L.marker(WORK, {
					icon: L.divIcon({ html: '💼', className: '', iconSize: [24, 24], iconAnchor: [12, 12] })
				})
					.bindTooltip(`Jobb — ${esc(work.label)}`)
					.addTo(map);
			}
			layer = L.layerGroup().addTo(map);
			map.on('dragstart', () => (userMoved = true));
			container.addEventListener('wheel', () => (userMoved = true), { passive: true });
			container
				.querySelector('.leaflet-control-zoom')
				?.addEventListener('click', () => (userMoved = true));
			draw();
		})();
		// Leaflet measures its container once; in the split layout the column settles after
		// mount (and changes with the window), which left grey untiled strips and a fit computed
		// for the wrong size
		const resize = new ResizeObserver(() => {
			if (!map) return;
			map.invalidateSize();
			if (fittedBounds && !userMoved)
				map.fitBounds(fittedBounds, { padding: [30, 30], maxZoom: 14 });
		});
		resize.observe(container);
		return () => {
			cancelled = true;
			resize.disconnect();
			map?.remove();
		};
	});

	// Redraw when filters change the listing set
	$effect(() => {
		void listings;
		draw();
	});

	$effect(() => {
		applyHighlight(highlight);
	});

	const missing = $derived(listings.filter((l) => l.lat === null || l.lon === null).length);
</script>

<div class="overflow-hidden rounded-xl border border-gray-200">
	<div bind:this={container} class="{heightClass} w-full"></div>
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
