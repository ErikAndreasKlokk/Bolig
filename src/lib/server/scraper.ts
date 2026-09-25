import {
	eq,
	notInArray,
	isNull,
	isNotNull,
	and,
	or,
	lt,
	gt,
	inArray,
	desc,
	sql
} from 'drizzle-orm';
import { db } from './db';
import { listings, priceHistory, type Listing } from './db/schema';
import { fetchAllListings, fetchDetails } from './finn';
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
			// A scrape can miss a field (Finn's markup varies) and return null where we
			// previously had a value. Keep the known price instead of wiping it — otherwise the
			// effective price falls back to the (lower) prisantydning and looks like a price drop.
			const newTotal = l.priceTotal ?? prev.priceTotal;
			const newSuggestion = l.priceSuggestion ?? prev.priceSuggestion;

			const priceChanged = newTotal !== prev.priceTotal || newSuggestion !== prev.priceSuggestion;
			if (priceChanged) {
				await db.insert(priceHistory).values({
					finnkode: l.finnkode,
					priceTotal: newTotal,
					priceSuggestion: newSuggestion,
					recordedAt: now
				});
				// Compare like with like: only flag a drop when the *same* metric fell. Prefer
				// totalpris when both old and new have it, otherwise compare prisantydning.
				let oldPrice: number | null = null;
				let newPrice: number | null = null;
				if (prev.priceTotal !== null && newTotal !== null) {
					oldPrice = prev.priceTotal;
					newPrice = newTotal;
				} else if (prev.priceSuggestion !== null && newSuggestion !== null) {
					oldPrice = prev.priceSuggestion;
					newPrice = newSuggestion;
				}
				if (oldPrice !== null && newPrice !== null && newPrice < oldPrice) {
					dropKeys.push({ finnkode: l.finnkode, oldPrice, newPrice });
				}
			}
			await db
				.update(listings)
				.set({
					heading: l.heading,
					url: l.url,
					priceTotal: newTotal,
					priceSuggestion: newSuggestion,
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

	await enrichDetails(now);

	// Notify about new listings — but not on the very first run (would spam hundreds)
	const unnotified = await db.select().from(listings).where(isNull(listings.notifiedAt));

	if (isBootstrap) {
		console.log(
			`Bootstrap run — marking ${unnotified.length} listings as notified without sending`
		);
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

	console.log(
		`Scrape done: ${fetched.length} total, ${newKeys.length} new, ${dropKeys.length} price drops`
	);
	return { total: fetched.length, added: newKeys.length };
}

/** Fetch one ad's detail page and store it. A gone ad (404) is marked fetched with no data. */
export async function refreshDetails(finnkode: string, url: string, now = new Date()) {
	const d = await fetchDetails(url);
	await db
		.update(listings)
		.set(
			d
				? { ...d, detailsFetchedAt: now }
				: { viewings: [], images: [], facts: [], facilities: [], detailsFetchedAt: now }
		)
		.where(eq(listings.finnkode, finnkode));
}

// Detail pages cost one request each (~900 active listings), so spread them over runs.
const DETAIL_BUDGET = 150;
// Viewings get added/changed after publication, so re-fetch relevant listings this often.
const DETAIL_REFRESH_MS = 20 * 60 * 60 * 1000;
// Refreshing all ~900 daily would be too many requests; viewings are mostly scheduled in the
// first couple of weeks, so only keep refreshing recent listings and the ones you follow.
const REFRESH_RECENT_MS = 14 * 24 * 60 * 60 * 1000;

// Pull bedrooms, district and viewings from each ad's detail page. Never-fetched listings go
// first (newest first, so this run's new listings are enriched before they're notified), then
// the stalest relevant ones.
async function enrichDetails(now: Date): Promise<void> {
	const staleBefore = new Date(now.getTime() - DETAIL_REFRESH_MS);
	const recentAfter = new Date(now.getTime() - REFRESH_RECENT_MS);
	const due = await db
		.select({ finnkode: listings.finnkode, url: listings.url })
		.from(listings)
		.where(
			or(
				isNull(listings.detailsFetchedAt),
				// Enriched before photos/facts were stored — backfill once
				and(eq(listings.active, true), isNull(listings.images)),
				and(
					eq(listings.active, true),
					lt(listings.detailsFetchedAt, staleBefore),
					or(
						eq(listings.favorite, true),
						isNotNull(listings.status),
						and(eq(listings.hidden, false), gt(listings.firstSeenAt, recentAfter))
					)
				)
			)
		)
		.orderBy(
			sql`case when ${listings.detailsFetchedAt} is null then 0 when ${listings.images} is null then 1 else 2 end`,
			sql`${listings.detailsFetchedAt} asc nulls first`,
			desc(listings.active),
			desc(listings.firstSeenAt)
		)
		.limit(DETAIL_BUDGET);

	let ok = 0;
	let failures = 0;
	for (const { finnkode, url } of due) {
		try {
			await refreshDetails(finnkode, url, now);
			ok++;
			failures = 0;
		} catch (e) {
			console.error(`Detail fetch for ${finnkode} failed:`, e);
			// Several in a row usually means we're being rate-limited — try again next run
			if (++failures >= 3) break;
		}
		await new Promise((r) => setTimeout(r, 800));
	}
	console.log(`Fetched details for ${ok}/${due.length} listings`);
}

async function markNotified(rows: Listing[], when: Date) {
	for (const l of rows) {
		await db.update(listings).set({ notifiedAt: when }).where(eq(listings.finnkode, l.finnkode));
	}
}
