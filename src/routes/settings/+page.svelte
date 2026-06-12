<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	const s = $derived(data.settings);
</script>

<svelte:head>
	<title>Innstillinger — Boligjakt</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-8">
	<header class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">⚙ Innstillinger</h1>
		<a href="/" class="text-sm text-blue-600 hover:underline">← Tilbake</a>
	</header>

	<form method="POST" action="?/save" class="space-y-6">
		<section class="rounded-xl border border-gray-200 bg-white p-5">
			<h2 class="mb-3 font-semibold text-gray-800">Din økonomi</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				<label class="block text-sm">
					<span class="text-gray-700">Brutto årsinntekt (kr)</span>
					<input
						type="number"
						name="grossIncome"
						value={s.grossIncome}
						class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-700">Netto inntekt/mnd (kr)</span>
					<input
						type="number"
						name="netMonthly"
						value={s.netMonthly}
						class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-700">Egenkapital — sparing (kr)</span>
					<input
						type="number"
						name="savings"
						value={s.savings}
						class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-700">Gave fra foreldre (kr)</span>
					<input
						type="number"
						name="parentalGift"
						value={s.parentalGift}
						class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
			</div>
		</section>

		<section class="rounded-xl border border-gray-200 bg-white p-5">
			<h2 class="mb-3 font-semibold text-gray-800">Husholdning (medlåntakere)</h2>
			<label class="block text-sm">
				<span class="text-gray-700">
					Samlet brutto inntekt for alle på lånet (kr/år)
				</span>
				<input
					type="number"
					name="combinedIncome"
					value={s.combinedIncome}
					class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				/>
				<span class="mt-1 block text-xs text-gray-500">
					Brukes for gjeldsgradregelen (maks lån = 5× samlet inntekt). Ved kun deg selv, sett lik brutto årsinntekt.
				</span>
			</label>
		</section>

		<section class="rounded-xl border border-gray-200 bg-white p-5">
			<h2 class="mb-3 font-semibold text-gray-800">Lånevilkår</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				<label class="block text-sm">
					<span class="text-gray-700">Nominell rente (%)</span>
					<input
						type="number"
						step="0.01"
						name="interestRate"
						value={s.interestRate}
						class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-700">Stresstest-rente (%)</span>
					<input
						type="number"
						step="0.01"
						name="stressRate"
						value={s.stressRate}
						class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-700">Nedbetalingstid (år)</span>
					<input
						type="number"
						name="loanYears"
						value={s.loanYears}
						class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-700">Egenkapitalkrav (%)</span>
					<input
						type="number"
						name="minEquityPct"
						value={s.minEquityPct}
						class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</label>
			</div>
		</section>

		<div class="flex justify-end">
			<button
				type="submit"
				class="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white shadow hover:bg-blue-700"
			>
				Lagre
			</button>
		</div>
	</form>
</div>
