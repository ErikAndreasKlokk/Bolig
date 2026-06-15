import { eq, notInArray, isNull, and, inArray } from 'drizzle-orm';
import { db } from './db';
import { listings, priceHistory, type Listing } from './db/schema';
import { fetchAllListings } from './finn';
import { transitMinutesToWork, geocodeAddress } from './entur';
import { notifyNewListings, notifyPriceDrops, type PriceDrop } from './discord';

let running = false;

export async function runScrape(): Promise<{ total: number; added: number }> {
	if (running) {
		console.log('Scrape already running — skipping');
		return { total: 0, added: 0 };
	}
	running = true;
	try {
		return await doScrape();
	} finally {
		running = false;
	}
}

async function doScrape(): Promise<{ total: number; added: number }> {
	console.log('Scrape started');
	const fetched = await fetchAllListings();
	console.log(`Fetched ${fetched.length} listings from Finn`);

	const existing = await db
		.select({
			finnkode: listings.finnkode,
			priceTotal: listings.priceTotal,
			priceSuggestion: listings.priceSuggestion
		})
		.from(listings);
	const existingMap = new Map(existing.map((e) => [e.finnkode, e]));
	const isBootstrap = existingMap.size === 0;

	const now = new Date();
	const newKeys: string[] = [];
	// finnkodes whose effective price went down — full rows are fetched after the loop
	const dropKeys: { finnkode: string; oldPrice: number; newPrice: number }[] = [];

	for (const l of fetched) {
		const prev = existingMap.get(l.finnkode);
		if (prev) {
			const priceChanged =
				l.priceTotal !== prev.priceTotal || l.priceSuggestion !== prev.priceSuggestion;
			if (priceChanged) {
				await db.insert(priceHistory).values({
					finnkode: l.finnkode,
					priceTotal: l.priceTotal,
					priceSuggestion: l.priceSuggestion,
					recordedAt: now
				});
				// Use totalpris when available, otherwise prisantydning, as the comparable price
				const oldPrice = prev.priceTotal ?? prev.priceSuggestion;
				const newPrice = l.priceTotal ?? l.priceSuggestion;
				if (oldPrice !== null && newPrice !== null && newPrice < oldPrice) {
					dropKeys.push({ finnkode: l.finnkode, oldPrice, newPrice });
				}
			}
			await db
				.update(listings)
				.set({
					heading: l.heading,
					priceTotal: l.priceTotal,
					priceSuggestion: l.priceSuggestion,
					sharedCost: l.sharedCost,
					imageUrl: l.imageUrl,
					lastSeenAt: now,
					active: true
				})
				.where(eq(listings.finnkode, l.finnkode));
		} else {
			await db.insert(listings).values({ ...l, lastSeenAt: now });
			// Seed the history with the first observed price so graphs have a starting point
			await db.insert(priceHistory).values({
				finnkode: l.finnkode,
				priceTotal: l.priceTotal,
				priceSuggestion: l.priceSuggestion,
				recordedAt: now
			});
			newKeys.push(l.finnkode);
		}
	}

	// Listings gone from the search results are sold/withdrawn — mark inactive
	const fetchedKeys = fetched.map((l) => l.finnkode);
	if (fetchedKeys.length > 0) {
		await db
			.update(listings)
			.set({ active: false })
			.where(notInArray(listings.finnkode, fetchedKeys));
	}

	// Geocode any active listing that has an address but no coordinates yet
	const missingCoords = await db
		.select()
		.from(listings)
		.where(and(isNull(listings.lat), eq(listings.active, true)));

	for (const l of missingCoords) {
		if (!l.address) continue;
		const coords = await geocodeAddress(l.address);
		if (coords) {
			await db
				.update(listings)
				.set({ lat: coords.lat, lon: coords.lon })
				.where(eq(listings.finnkode, l.finnkode));
		}
		await new Promise((r) => setTimeout(r, 300));
	}

	// Compute travel time for listings that now have coords but no minutes yet
	const missingTravel = await db
		.select()
		.from(listings)
		.where(and(isNull(listings.travelMinutes), eq(listings.active, true)));

	for (const l of missingTravel) {
		if (l.lat === null || l.lon === null) continue;
		const minutes = await transitMinutesToWork(l.lat, l.lon);
		if (minutes !== null) {
			await db
				.update(listings)
				.set({ travelMinutes: minutes })
				.where(eq(listings.finnkode, l.finnkode));
		}
		await new Promise((r) => setTimeout(r, 300));
	}

	// Notify about new listings — but not on the very first run (would spam hundreds)
	const unnotified = await db
		.select()
		.from(listings)
		.where(isNull(listings.notifiedAt));

	if (isBootstrap) {
		console.log(`Bootstrap run — marking ${unnotified.length} listings as notified without sending`);
		await markNotified(unnotified, now);
	} else if (unnotified.length > 0) {
		const sorted = [...unnotified].sort(
			(a, b) => (a.travelMinutes ?? 999) - (b.travelMinutes ?? 999)
		);
		await notifyNewListings(sorted);
		await markNotified(unnotified, now);
	}

	// Notify about price drops on already-known listings (never on the bootstrap run)
	if (!isBootstrap && dropKeys.length > 0) {
		const rows = await db
			.select()
			.from(listings)
			.where(
				inArray(
					listings.finnkode,
					dropKeys.map((d) => d.finnkode)
				)
			);
		const byKey = new Map(rows.map((r) => [r.finnkode, r]));
		const drops: PriceDrop[] = dropKeys
			.map((d) => {
				const listing = byKey.get(d.finnkode);
				return listing ? { listing, oldPrice: d.oldPrice, newPrice: d.newPrice } : null;
			})
			.filter((d): d is PriceDrop => d !== null && !d.listing.hidden);
		if (drops.length > 0) await notifyPriceDrops(drops);
		console.log(`Notified ${drops.length} price drops`);
	}

	console.log(`Scrape done: ${fetched.length} total, ${newKeys.length} new, ${dropKeys.length} price drops`);
	return { total: fetched.length, added: newKeys.length };
}

async function markNotified(rows: Listing[], when: Date) {
	for (const l of rows) {
		await db.update(listings).set({ notifiedAt: when }).where(eq(listings.finnkode, l.finnkode));
	}
}
