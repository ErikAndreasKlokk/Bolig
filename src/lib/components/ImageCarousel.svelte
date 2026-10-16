<script lang="ts">
	import { page } from '$app/state';
	import { pushState } from '$app/navigation';
	import type { ListingImage } from '$lib/listing';
	import ImageLightbox from './ImageLightbox.svelte';

	let { images }: { images: ListingImage[] } = $props();

	let track: HTMLDivElement | undefined = $state();
	let thumbs: HTMLDivElement | undefined = $state();
	let lightbox: ImageLightbox | undefined = $state();
	let index = $state(0);

	const thumbUrl = (url: string) => url.replace('/1280w/', '/240w/');

	// Full-screen viewer state lives in shallow-routing history, like the drawer, so Back (or
	// swipe-back on a phone) closes the photo instead of the whole listing
	const photoOpen = $derived(!!page.state.photo);
	const openPhoto = () => pushState('', { ...page.state, photo: true });
	const closePhoto = () => history.back();

	// Wraps around: past the last photo goes back to the first, and vice versa
	function go(i: number, behavior: 'smooth' | 'instant' = 'smooth') {
		if (!track || images.length === 0) return;
		const n = images.length;
		const target = ((i % n) + n) % n;
		track.scrollTo({ left: target * track.clientWidth, behavior });
	}

	// Swiping/scrolling is native (scroll-snap); derive the current slide from the scroll offset
	function onScroll() {
		if (!track) return;
		const i = Math.round(track.scrollLeft / track.clientWidth);
		if (i !== index) {
			index = i;
			const thumb = thumbs?.children[i] as HTMLElement | undefined;
			thumb?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
		}
	}

	export function handleKey(e: KeyboardEvent): boolean {
		if (photoOpen) return lightbox?.handleKey(e) ?? false;
		if (e.key === 'ArrowLeft') go(index - 1);
		else if (e.key === 'ArrowRight') go(index + 1);
		else return false;
		return true;
	}

	// Start at the first photo whenever a different listing is shown
	$effect(() => {
		void images;
		index = 0;
		track?.scrollTo({ left: 0 });
	});

	// Keep the carousel behind the viewer on the same photo, so closing lands where you were
	$effect(() => {
		if (photoOpen) go(index, 'instant');
	});
</script>

{#if images.length > 0}
	<!-- lg: fills the drawer's gallery column (a flex column) rather than a fixed 4:3 box -->
	<div class="relative bg-gray-900 lg:min-h-0 lg:flex-1">
		<div
			bind:this={track}
			onscroll={onScroll}
			class="flex aspect-[4/3] snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto lg:aspect-auto lg:h-full [&::-webkit-scrollbar]:hidden"
		>
			{#each images as img, i (img.url)}
				<div class="h-full w-full shrink-0 snap-center">
					<button
						type="button"
						onclick={openPhoto}
						class="h-full w-full cursor-zoom-in"
						aria-label="Vis bilde {i + 1} i full størrelse"
					>
						<img
							src={img.url}
							alt={img.caption ?? `Bilde ${i + 1}`}
							class="h-full w-full object-contain"
							loading={i < 2 ? 'eager' : 'lazy'}
							draggable="false"
						/>
					</button>
				</div>
			{/each}
		</div>

		{#if images.length > 1}
			<button
				type="button"
				onclick={() => go(index - 1)}
				class="absolute top-1/2 left-2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-xl shadow hover:bg-white sm:flex"
				aria-label="Forrige bilde">‹</button
			>
			<button
				type="button"
				onclick={() => go(index + 1)}
				class="absolute top-1/2 right-2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-xl shadow hover:bg-white sm:flex"
				aria-label="Neste bilde">›</button
			>
		{/if}
		<button
			type="button"
			onclick={openPhoto}
			class="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white hover:bg-black/80"
			aria-label="Forstørr bildet">⤢ Forstørr</button
		>
		<span
			class="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white tabular-nums"
		>
			{index + 1} / {images.length}
		</span>
	</div>

	<p class="min-h-10 px-4 pt-2 text-sm text-gray-600 sm:px-5">
		{images[index]?.caption ?? ''}
	</p>

	{#if images.length > 1}
		<div
			bind:this={thumbs}
			class="flex [scrollbar-width:thin] gap-1.5 overflow-x-auto px-4 pb-3 sm:px-5"
		>
			{#each images as img, i (img.url)}
				<button
					type="button"
					onclick={() => go(i)}
					class="h-12 w-16 shrink-0 overflow-hidden rounded-md ring-2 {i === index
						? 'ring-blue-500'
						: 'opacity-70 ring-transparent hover:opacity-100'}"
					aria-label="Vis bilde {i + 1}"
				>
					<img src={thumbUrl(img.url)} alt="" class="h-full w-full object-cover" loading="lazy" />
				</button>
			{/each}
		</div>
	{/if}

	{#if photoOpen}
		<ImageLightbox bind:this={lightbox} {images} bind:index onclose={closePhoto} />
	{/if}
{/if}
