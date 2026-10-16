<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { ListingImage } from '$lib/listing';

	let {
		images,
		index = $bindable(),
		onclose
	}: { images: ListingImage[]; index: number; onclose: () => void } = $props();

	const MAX_SCALE = 5;
	const DOUBLE_TAP_ZOOM = 2.5;
	// A horizontal drag this far (at 1×) flips to the next/previous photo
	const SWIPE_PX = 60;

	// Finn's CDN has a larger rendition than the carousel's 1280w; fall back if it's missing
	const largeUrl = (url: string) => url.replace('/1280w/', '/1600w/');
	const failedLarge = new SvelteSet<string>();
	const src = $derived.by(() => {
		const url = images[index]?.url ?? '';
		return failedLarge.has(url) ? url : largeUrl(url);
	});

	let stage: HTMLDivElement | undefined = $state();
	let img: HTMLImageElement | undefined = $state();
	let dialog: HTMLDivElement | undefined = $state();

	// The photo is drawn object-contain over the whole stage, then moved with
	// translate(tx, ty) scale(scale) around the stage centre.
	let scale = $state(1);
	let tx = $state(0);
	let ty = $state(0);
	// Ease button/double-tap/snap-back changes; follow the finger exactly while dragging
	let animate = $state(false);

	const zoomed = $derived(scale > 1.01);

	function reset() {
		scale = 1;
		tx = 0;
		ty = 0;
	}

	function show(i: number) {
		const n = images.length;
		animate = false;
		index = ((i % n) + n) % n; // wraps both ways
		reset();
	}

	// The photo's on-screen size at 1× (object-contain), to know how far it may be panned
	function fitted() {
		const W = stage?.clientWidth ?? 0;
		const H = stage?.clientHeight ?? 0;
		const nw = img?.naturalWidth || W;
		const nh = img?.naturalHeight || H;
		const r = Math.min(W / nw, H / nh) || 1;
		return { W, H, w: nw * r, h: nh * r };
	}

	// Keep the photo covering the stage: no panning past its edges
	function clampPan() {
		const { W, H, w, h } = fitted();
		const mx = Math.max(0, (w * scale - W) / 2);
		const my = Math.max(0, (h * scale - H) / 2);
		tx = Math.min(mx, Math.max(-mx, tx));
		ty = Math.min(my, Math.max(-my, ty));
	}

	// Client coordinates → offset from the stage centre
	function local(x: number, y: number) {
		const r = stage!.getBoundingClientRect();
		return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 };
	}

	/** Zoom to `next`, keeping the photo point under (cx, cy) where it is. */
	function zoomAt(cx: number, cy: number, next: number) {
		const s = Math.min(MAX_SCALE, Math.max(1, next));
		const p = local(cx, cy);
		tx = p.x - ((p.x - tx) * s) / scale;
		ty = p.y - ((p.y - ty) * s) / scale;
		scale = s;
		if (s === 1) reset();
		else clampPan();
	}

	function zoomBy(factor: number) {
		const r = stage!.getBoundingClientRect();
		animate = true;
		zoomAt(r.left + r.width / 2, r.top + r.height / 2, scale * factor);
	}

	// --- Pointer gestures: drag to pan (zoomed) or swipe (1×), pinch to zoom, double-tap ---

	// Gesture bookkeeping only, never rendered
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const pointers = new Map<number, { x: number; y: number }>();
	let drag: { x: number; y: number; tx: number; ty: number } | null = null;
	let pinch: {
		dist: number;
		mid: { x: number; y: number };
		scale: number;
		tx: number;
		ty: number;
	} | null = null;
	let moved = false;
	let lastTap = { t: 0, x: 0, y: 0 };

	function pinchGeometry() {
		const [a, b] = [...pointers.values()];
		return {
			dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
			mid: local((a.x + b.x) / 2, (a.y + b.y) / 2)
		};
	}

	function startDrag() {
		const [p] = [...pointers.values()];
		drag = { x: p.x, y: p.y, tx, ty };
	}

	function onPointerDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		stage!.setPointerCapture(e.pointerId);
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		animate = false;
		if (pointers.size === 1) {
			moved = false;
			startDrag();
		} else if (pointers.size === 2) {
			moved = true; // not a tap
			drag = null;
			const g = pinchGeometry();
			pinch = { ...g, scale, tx, ty };
		}
	}

	function onPointerMove(e: PointerEvent) {
		if (!pointers.has(e.pointerId)) return;
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

		if (pinch && pointers.size >= 2) {
			const g = pinchGeometry();
			const s = Math.min(MAX_SCALE, Math.max(1, (pinch.scale * g.dist) / pinch.dist));
			// The photo point that was under the fingers' midpoint follows the midpoint
			tx = g.mid.x - ((pinch.mid.x - pinch.tx) * s) / pinch.scale;
			ty = g.mid.y - ((pinch.mid.y - pinch.ty) * s) / pinch.scale;
			scale = s;
			clampPan();
		} else if (drag) {
			const dx = e.clientX - drag.x;
			const dy = e.clientY - drag.y;
			if (Math.hypot(dx, dy) > 8) moved = true;
			if (zoomed) {
				tx = drag.tx + dx;
				ty = drag.ty + dy;
				clampPan();
			} else {
				tx = dx; // follow the finger sideways as swipe feedback
			}
		}
	}

	function onPointerUp(e: PointerEvent) {
		if (!pointers.has(e.pointerId)) return;
		const start = drag;
		pointers.delete(e.pointerId);

		if (pinch) {
			if (pointers.size === 1) {
				// Lifted one finger: keep panning with the other
				pinch = null;
				startDrag();
			} else if (pointers.size === 0) {
				pinch = null;
				if (scale < 1.05) {
					animate = true;
					reset();
				}
			}
			return;
		}
		if (pointers.size > 0) return;
		drag = null;

		if (!moved) {
			// Tap; a second one close by in time and place toggles zoom
			const now = performance.now();
			if (now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
				animate = true;
				if (zoomed) reset();
				else zoomAt(e.clientX, e.clientY, DOUBLE_TAP_ZOOM);
				lastTap = { t: 0, x: 0, y: 0 };
			} else {
				lastTap = { t: now, x: e.clientX, y: e.clientY };
			}
			return;
		}

		if (!zoomed && start) {
			const dx = e.clientX - start.x;
			const dy = e.clientY - start.y;
			if (images.length > 1 && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
				show(index + (dx < 0 ? 1 : -1));
			} else {
				animate = true;
				reset();
			}
		}
	}

	function onPointerCancel(e: PointerEvent) {
		pointers.delete(e.pointerId);
		if (pointers.size === 0) {
			drag = null;
			pinch = null;
			if (!zoomed) {
				animate = true;
				reset();
			}
		}
	}

	// Svelte registers wheel listeners as passive, and we need preventDefault to stop the
	// page from scrolling — so attach it by hand.
	function wheelZoom(node: HTMLElement) {
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			animate = false;
			const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
			// Trackpad pinches arrive as ctrl+wheel with small deltas
			const speed = e.ctrlKey ? 0.01 : 0.0015;
			zoomAt(e.clientX, e.clientY, scale * Math.exp(-dy * speed));
		};
		node.addEventListener('wheel', onWheel, { passive: false });
		return () => node.removeEventListener('wheel', onWheel);
	}

	/** Keys are routed here by the drawer (it owns the window keydown listener). */
	export function handleKey(e: KeyboardEvent): boolean {
		if (e.key === 'Escape') onclose();
		else if (e.key === 'ArrowLeft') show(index - 1);
		else if (e.key === 'ArrowRight') show(index + 1);
		else if (e.key === '+' || e.key === '=') zoomBy(1.5);
		else if (e.key === '-') zoomBy(1 / 1.5);
		else if (e.key === '0') {
			animate = true;
			reset();
		} else return false;
		return true;
	}

	$effect(() => {
		dialog?.focus();
	});

	const btn =
		'flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-xl text-white ring-1 ring-white/20 hover:bg-black/70 disabled:opacity-30';
</script>

<!-- Inside the drawer's stacking context, so it only has to cover the drawer -->
<div
	bind:this={dialog}
	role="dialog"
	aria-modal="true"
	aria-label="Bildevisning"
	tabindex="-1"
	class="fixed inset-0 z-50 flex flex-col bg-black outline-none select-none"
>
	<div
		class="flex items-center justify-between gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-white"
	>
		<span class="text-sm tabular-nums">{index + 1} / {images.length}</span>
		<div class="flex items-center gap-2">
			<button
				type="button"
				class={btn}
				onclick={() => zoomBy(1 / 1.5)}
				disabled={!zoomed}
				aria-label="Zoom ut">−</button
			>
			<button
				type="button"
				class={btn}
				onclick={() => zoomBy(1.5)}
				disabled={scale >= MAX_SCALE}
				aria-label="Zoom inn">+</button
			>
			<button type="button" class={btn} onclick={onclose} aria-label="Lukk bildevisning">✕</button>
		</div>
	</div>

	<div
		bind:this={stage}
		{@attach wheelZoom}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerCancel}
		role="presentation"
		class="relative min-h-0 flex-1 touch-none overflow-hidden {zoomed
			? 'cursor-grab active:cursor-grabbing'
			: 'cursor-zoom-in'}"
	>
		{#key src}
			<img
				bind:this={img}
				{src}
				alt={images[index]?.caption ?? `Bilde ${index + 1}`}
				draggable="false"
				onerror={() => failedLarge.add(images[index].url)}
				class="pointer-events-none h-full w-full object-contain {animate
					? 'transition-transform duration-200 ease-out'
					: ''}"
				style="transform: translate({tx}px, {ty}px) scale({scale})"
			/>
		{/key}

		{#if images.length > 1}
			<button
				type="button"
				onpointerdown={(e) => e.stopPropagation()}
				onclick={() => show(index - 1)}
				class="{btn} absolute top-1/2 left-2 -translate-y-1/2"
				aria-label="Forrige bilde">‹</button
			>
			<button
				type="button"
				onpointerdown={(e) => e.stopPropagation()}
				onclick={() => show(index + 1)}
				class="{btn} absolute top-1/2 right-2 -translate-y-1/2"
				aria-label="Neste bilde">›</button
			>
		{/if}
	</div>

	<p
		class="min-h-12 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-sm text-white/80"
	>
		{images[index]?.caption ?? ''}
		<span class="block text-xs text-white/40"
			>Dobbelttrykk eller rull for å zoome · dra for å flytte</span
		>
	</p>
</div>
