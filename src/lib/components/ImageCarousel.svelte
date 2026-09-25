<script lang="ts">
	import type { ListingImage } from '$lib/listing';

	let { images }: { images: ListingImage[] } = $props();

	let track: HTMLDivElement | undefined = $state();
	let thumbs: HTMLDivElement | undefined = $state();
	let index = $state(0);

	const thumbUrl = (url: string) => url.replace('/1280w/', '/240w/');

	function go(i: number) {
		if (!track || images.length === 0) return;
		const target = Math.max(0, Math.min(images.length - 1, i));
		track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' });
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
</script>

{#if images.length > 0}
	<div class="relative bg-gray-900">
		<div
			bind:this={track}
			onscroll={onScroll}
			class="flex aspect-[4/3] snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden"
		>
			{#each images as img, i (img.url)}
				<div class="h-full w-full shrink-0 snap-center">
					<img
						src={img.url}
						alt={img.caption ?? `Bilde ${i + 1}`}
						class="h-full w-full object-contain"
						loading={i < 2 ? 'eager' : 'lazy'}
						draggable="false"
					/>
				</div>
			{/each}
		</div>

		{#if images.length > 1}
			<button
				type="button"
				onclick={() => go(index - 1)}
				disabled={index === 0}
				class="absolute top-1/2 left-2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-xl shadow hover:bg-white disabled:opacity-0 sm:flex"
				aria-label="Forrige bilde">‹</button
			>
			<button
				type="button"
				onclick={() => go(index + 1)}
				disabled={index === images.length - 1}
				class="absolute top-1/2 right-2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-xl shadow hover:bg-white disabled:opacity-0 sm:flex"
				aria-label="Neste bilde">›</button
			>
		{/if}
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
{/if}
