<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import AreaPicker from '$lib/components/AreaPicker.svelte';
	import { OWNERSHIP_TYPES, PROPERTY_TYPES, TRAVEL_MODES } from '$lib/search';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const s = $derived(data.settings);

	let saving = $state(false);
	// Keep what was typed/ticked after saving instead of resetting the form
	const keepValues: SubmitFunction = () => {
		saving = true;
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	};

	const field =
		'mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
</script>

<svelte:head>
	<title>Innstillinger — Boligjakt</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-3 py-6 sm:px-4 sm:py-8">
	<header class="mb-6 flex items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold sm:text-3xl">⚙ Innstillinger</h1>
			<p class="mt-1 text-sm text-gray-500">Gjelder bare for {data.userName}</p>
		</div>
		<a
			href={resolve('/')}
			class="inline-flex min-h-10 shrink-0 items-center rounded-full border border-gray-200 px-3.5 text-sm text-blue-600"
		>
			← Tilbake
		</a>
	</header>

	<form method="POST" action="?/search" use:enhance={keepValues} class="mb-10 space-y-6">
		<section class="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
			<div class="mb-3 flex items-baseline justify-between gap-3">
				<h2 class="font-semibold text-gray-800">Hva leter du etter?</h2>
				{#if data.finnUrl}
					<a
						href={data.finnUrl}
						target="_blank"
						rel="external noopener noreferrer"
						class="shrink-0 text-sm text-blue-600 hover:underline">Se søket på Finn ↗</a
					>
				{/if}
			</div>

			<h3 class="mb-2 text-sm font-medium text-gray-700">Områder</h3>
			<AreaPicker initial={s.searchLocations} />

			<div class="mt-5 grid gap-4 sm:grid-cols-2">
				<label class="block text-sm">
					<span class="text-gray-700">Totalpris fra (kr)</span>
					<input
						type="number"
						inputmode="numeric"
						step="100000"
						name="priceFrom"
						value={s.priceFrom ?? ''}
						class={field}
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-700">Totalpris til (kr)</span>
					<input
						type="number"
						inputmode="numeric"
						step="100000"
						name="priceTo"
						value={s.priceTo ?? ''}
						class={field}
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-700">Min. størrelse (m²)</span>
					<input
						type="number"
						inputmode="numeric"
						name="minSizeM2"
						value={s.minSizeM2 ?? ''}
						class={field}
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-700">Min. soverom</span>
					<select name="minBedrooms" value={String(s.minBedrooms ?? '')} class={field}>
						<option value="">Alle</option>
						{#each [1, 2, 3, 4, 5] as n (n)}<option value={String(n)}>{n}+</option>{/each}
					</select>
				</label>
			</div>

			<fieldset class="mt-5">
				<legend class="mb-2 text-sm font-medium text-gray-700">
					Boligtype <span class="font-normal text-gray-500">(ingen valgt = alle)</span>
				</legend>
				<div class="flex flex-wrap gap-x-5 gap-y-2">
					{#each PROPERTY_TYPES as t (t.value)}
						<label class="inline-flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								name="propertyType"
								value={t.value}
								checked={s.propertyTypes.includes(t.value)}
							/>
							{t.label}
						</label>
					{/each}
				</div>
			</fieldset>

			<fieldset class="mt-5">
				<legend class="mb-2 text-sm font-medium text-gray-700">
					Eierform <span class="font-normal text-gray-500">(ingen valgt = alle)</span>
				</legend>
				<div class="flex flex-wrap gap-x-5 gap-y-2">
					{#each OWNERSHIP_TYPES as t (t.value)}
						<label class="inline-flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								name="ownershipType"
								value={t.value}
								checked={s.ownershipTypes.includes(t.value)}
							/>
							{t.label}
						</label>
					{/each}
				</div>
			</fieldset>
		</section>

		<section class="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
			<h2 class="mb-3 font-semibold text-gray-800">Reisetid</h2>
			<label class="block text-sm">
				<span class="text-gray-700">Jobb/skole — adresse</span>
				<input
					type="text"
					name="workAddress"
					value={s.workAddress ?? ''}
					placeholder="f.eks. Verkstedveien 1, Oslo"
					class={field}
				/>
				<span class="mt-1 block text-xs text-gray-500">
					Reisetid regnes fra hver bolig hit, med ankomst kl. 08:30 en hverdag. La stå tom for å
					droppe reisetid.
				</span>
			</label>
			<fieldset class="mt-4">
				<legend class="mb-2 text-sm text-gray-700">Reisemåte</legend>
				<div class="flex gap-5">
					{#each Object.entries(TRAVEL_MODES) as [mode, label] (mode)}
						<label class="inline-flex items-center gap-2 text-sm">
							<input type="radio" name="travelMode" value={mode} checked={s.travelMode === mode} />
							{label}
						</label>
					{/each}
				</div>
			</fieldset>
		</section>

		{#if form && 'error' in form && form.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{form.error}</p>
		{:else if form && 'saved' in form && form.saved}
			<p class="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
				{form.refreshing
					? 'Lagret. Henter boliger fra Finn nå — det kan ta noen minutter før alt er på plass.'
					: 'Lagret.'}
			</p>
		{/if}

		<div class="flex justify-end">
			<button
				type="submit"
				disabled={saving}
				class="h-11 w-full rounded-lg bg-blue-600 px-5 font-medium text-white shadow hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
			>
				{saving ? 'Lagrer…' : 'Lagre søk'}
			</button>
		</div>
	</form>

	<form method="POST" action="?/save" class="space-y-6">
		<section class="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
			<h2 class="mb-3 font-semibold text-gray-800">Din økonomi</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				<label class="block text-sm">
					<span class="text-gray-700">Brutto årsinntekt (kr)</span>
					<input
						type="number"
						inputmode="numeric"
						name="grossIncome"
						value={s.grossIncome}
						class="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-700">Netto inntekt/mnd (kr)</span>
					<input
						type="number"
						inputmode="numeric"
						name="netMonthly"
						value={s.netMonthly}
						class="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-700">Egenkapital — sparing (kr)</span>
					<input
						type="number"
						inputmode="numeric"
						name="savings"
						value={s.savings}
						class="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-700">Gave fra foreldre (kr)</span>
					<input
						type="number"
						inputmode="numeric"
						name="parentalGift"
						value={s.parentalGift}
						class="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
			</div>
		</section>

		<section class="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
			<h2 class="mb-3 font-semibold text-gray-800">Husholdning (medlåntakere)</h2>
			<label class="block text-sm">
				<span class="text-gray-700"> Samlet brutto inntekt for alle på lånet (kr/år) </span>
				<input
					type="number"
					inputmode="numeric"
					name="combinedIncome"
					value={s.combinedIncome}
					class="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				/>
				<span class="mt-1 block text-xs text-gray-500">
					Brukes for gjeldsgradregelen (maks lån = 5× samlet inntekt). Ved kun deg selv, sett lik
					brutto årsinntekt.
				</span>
			</label>
		</section>

		<section class="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
			<h2 class="mb-3 font-semibold text-gray-800">Lånevilkår</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				<label class="block text-sm">
					<span class="text-gray-700">Nominell rente (%)</span>
					<input
						type="number"
						inputmode="decimal"
						step="0.01"
						name="interestRate"
						value={s.interestRate}
						class="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-700">Stresstest-rente (%)</span>
					<input
						type="number"
						inputmode="decimal"
						step="0.01"
						name="stressRate"
						value={s.stressRate}
						class="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-700">Nedbetalingstid (år)</span>
					<input
						type="number"
						inputmode="numeric"
						name="loanYears"
						value={s.loanYears}
						class="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-700">Egenkapitalkrav (%)</span>
					<input
						type="number"
						inputmode="numeric"
						name="minEquityPct"
						value={s.minEquityPct}
						class="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
			</div>
		</section>

		<div
			class="sticky bottom-0 -mx-3 border-t border-gray-200 bg-white/95 px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
		>
			<button
				type="submit"
				class="h-11 w-full rounded-lg bg-blue-600 px-5 font-medium text-white shadow hover:bg-blue-700 sm:w-auto"
			>
				Lagre
			</button>
		</div>
	</form>
</div>
