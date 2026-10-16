import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { listingMatches } from '$lib/server/db/schema';
import { getSettings, updateSettings } from '$lib/server/settings';
import { requireUser } from '$lib/server/auth';
import { geocodeAddress } from '$lib/server/entur';
import { buildSearchUrl } from '$lib/server/finn';
import { runScrape } from '$lib/server/scraper';
import { FINN_COUNTIES } from '$lib/locations';
import {
	OWNERSHIP_TYPES,
	PROPERTY_TYPES,
	searchKey,
	TRAVEL_MODES,
	type FinnSearch,
	type TravelMode
} from '$lib/search';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const settings = await getSettings(user.id);
	return {
		settings,
		userName: user.name,
		finnUrl: settings.searchLocations.length > 0 ? buildSearchUrl(settings) : null
	};
};

function num(v: FormDataEntryValue | null, fallback: number): number {
	if (v === null) return fallback;
	const n = Number(String(v).replace(/[^\d.-]/g, ''));
	return Number.isFinite(n) ? n : fallback;
}

/** Positive whole number, or null when left empty. */
function optInt(v: FormDataEntryValue | null): number | null {
	const n = Number(String(v ?? '').replace(/[^\d]/g, ''));
	return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

const countyCodes = new Set(FINN_COUNTIES.map((c) => c.code));
const childToCounty = new Map(
	FINN_COUNTIES.flatMap((c) => c.children.map((m) => [m.code, c.code] as const))
);

// Known codes only; a whole county makes its own municipalities redundant
function cleanLocations(raw: string[]): string[] {
	const codes = [...new Set(raw)].filter((c) => countyCodes.has(c) || childToCounty.has(c));
	return codes.filter((c) => !codes.includes(childToCounty.get(c) ?? ''));
}

const onlyValid = (raw: string[], options: readonly { value: string }[]) =>
	[...new Set(raw)].filter((v) => options.some((o) => o.value === v));

// Fire and forget: the scrape takes minutes, and it logs its own failures
function scrapeSoon() {
	runScrape().catch((e) => console.error('Scrape after settings change failed:', e));
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const current = await getSettings(user.id);
		await updateSettings(user.id, {
			grossIncome: Math.round(num(data.get('grossIncome'), current.grossIncome)),
			netMonthly: Math.round(num(data.get('netMonthly'), current.netMonthly)),
			savings: Math.round(num(data.get('savings'), current.savings)),
			parentalGift: Math.round(num(data.get('parentalGift'), current.parentalGift)),
			combinedIncome: Math.round(num(data.get('combinedIncome'), current.combinedIncome)),
			interestRate: num(data.get('interestRate'), current.interestRate),
			stressRate: num(data.get('stressRate'), current.stressRate),
			loanYears: Math.round(num(data.get('loanYears'), current.loanYears)),
			minEquityPct: Math.round(num(data.get('minEquityPct'), current.minEquityPct))
		});
		throw redirect(303, '/');
	},

	search: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const current = await getSettings(user.id);

		const minBedrooms = optInt(data.get('minBedrooms'));
		const search: FinnSearch = {
			searchLocations: cleanLocations(data.getAll('location').map(String)),
			priceFrom: optInt(data.get('priceFrom')),
			priceTo: optInt(data.get('priceTo')),
			propertyTypes: onlyValid(data.getAll('propertyType').map(String), PROPERTY_TYPES),
			ownershipTypes: onlyValid(data.getAll('ownershipType').map(String), OWNERSHIP_TYPES),
			minSizeM2: optInt(data.get('minSizeM2')),
			minBedrooms: minBedrooms && Math.min(minBedrooms, 5)
		};
		if (search.priceFrom && search.priceTo && search.priceFrom > search.priceTo)
			return fail(400, { error: 'Prisen «fra» er høyere enn «til».' });

		const modeRaw = String(data.get('travelMode'));
		const travelMode: TravelMode = modeRaw in TRAVEL_MODES ? (modeRaw as TravelMode) : 'transit';
		const workAddress = String(data.get('workAddress') ?? '').trim() || null;

		// Only geocode when the address actually changed
		let work = {
			workAddress: current.workAddress,
			workLat: current.workLat,
			workLon: current.workLon
		};
		if (workAddress !== current.workAddress) {
			if (!workAddress) work = { workAddress: null, workLat: null, workLon: null };
			else {
				const found = await geocodeAddress(workAddress);
				if (!found) return fail(400, { error: `Fant ikke adressen «${workAddress}».` });
				work = { workAddress: found.label, workLat: found.lat, workLon: found.lon };
			}
		}

		const searchChanged = searchKey(search) !== searchKey(current);
		const travelChanged =
			work.workLat !== current.workLat ||
			work.workLon !== current.workLon ||
			travelMode !== current.travelMode;

		await updateSettings(user.id, {
			...search,
			...work,
			travelMode,
			// The next scrape files the new search's matches as seen instead of posting them all
			...(searchChanged ? { searchPending: true } : {})
		});
		if (travelChanged) {
			await db
				.update(listingMatches)
				.set({ travelMinutes: null })
				.where(eq(listingMatches.userId, user.id));
		}
		if (searchChanged || travelChanged) scrapeSoon();

		return { saved: true, refreshing: searchChanged || travelChanged };
	}
};
