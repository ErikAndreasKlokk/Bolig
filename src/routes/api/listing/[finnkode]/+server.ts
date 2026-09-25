import { error, json } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { listings, priceHistory } from '$lib/server/db/schema';
import { refreshDetails } from '$lib/server/scraper';
import type { ListingDetail } from '$lib/listing';

const detailColumns = {
	url: listings.url,
	active: listings.active,
	images: listings.images,
	facts: listings.facts,
	description: listings.description,
	facilities: listings.facilities
};

// Drawer data for one listing. If the scraper hasn't reached it yet, fetch the ad page now
// so opening a listing never shows an empty drawer.
export async function GET({ params }) {
	const where = eq(listings.finnkode, params.finnkode);
	let [row] = await db.select(detailColumns).from(listings).where(where);
	if (!row) error(404, 'Ukjent bolig');

	if (row.images === null && row.active) {
		try {
			await refreshDetails(params.finnkode, row.url);
			[row] = await db.select(detailColumns).from(listings).where(where);
		} catch (e) {
			console.error(`On-demand detail fetch for ${params.finnkode} failed:`, e);
		}
	}

	const hist = await db
		.select({
			priceTotal: priceHistory.priceTotal,
			priceSuggestion: priceHistory.priceSuggestion,
			recordedAt: priceHistory.recordedAt
		})
		.from(priceHistory)
		.where(eq(priceHistory.finnkode, params.finnkode))
		.orderBy(asc(priceHistory.recordedAt));

	const detail: ListingDetail = {
		images: row.images ?? [],
		facts: row.facts ?? [],
		description: row.description,
		facilities: row.facilities ?? [],
		history: hist.flatMap((h) => {
			const price = h.priceTotal ?? h.priceSuggestion;
			return price === null ? [] : [{ price, at: h.recordedAt.toISOString() }];
		})
	};
	return json(detail);
}
