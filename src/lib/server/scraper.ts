import {
	eq,
	isNull,
	isNotNull,
	and,
	or,
	lt,
	gt,
	inArray,
	notInArray,
	desc,
	not,
	sql
} from 'drizzle-orm';
import { db } from './db';
import {
	listings,
	listingMatches,
	listingUserState,
	priceHistory,
	userSettings,
	type Listing,
	type UserSettings
} from './db/schema';
import { USERS, type User } from '$lib/users';
import { searchKey } from '$lib/search';
import { fetchAllListings, fetchDetails, type FinnListing } from './finn';
import { travelMinutes, geocodeAddress } from './entur';
import { notifyNewListings, notifyPriceDrops, webhookFor, type PriceDrop } from './discord';

let running = false;

// Tracking is per user (listing_user_state). Someone follows a listing if they starred it or
// gave it a status; it's only uninteresting to everyone if *everyone* hid it.
const followedBySomeone = sql`exists (select 1 from ${listingUserState} s where s.finnkode = ${listings.finnkode} and (s.favorite or s.status is not null))`;
const hiddenByEveryone = sql`((select count(*) from ${listingUserState} s where s.finnkode = ${listings.finnkode} and s.hidden) >= ${USERS.length})`;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Asked for while one was running (e.g. someone saved a new search): run once more afterwards
let rerunQueued = false;

export async function runScrape(): Promise<{ total: number; added: number }> {
	if (running) {
		console.log('Scrape already running — queued another run after it');
		rerunQueued = true;
		return { total: 0, added: 0 };
	}
	running = true;
	try {
		let result = await doScrape();
		while (rerunQueued) {
			rerunQueued = false;
			result = await doScrape();
		}
		return result;
	} finally {
		running = false;
	}
}

interface UserRun {
	user: User;
	settings: UserSettings;
	/** finnkodes this user's search returned; null when the search failed (leave matches alone) */
	keys: Set<string> | null;
}

async function doScrape(): Promise<{ total: number; added: number }> {
	console.log('Scrape started');
	const now = new Date();

	// 1. Run each user's own Finn search — once per distinct search, since several users may
	//    have identical criteria
	const settingsRows = await db.select().from(userSettings);
	const settingsById = new Map(settingsRows.map((s) => [s.id, s]));
	const resultsBySearch = new Map<string, FinnListing[] | null>();
	const union = new Map<string, FinnListing>();
	const runs: UserRun[] = [];

	for (const user of USERS) {
		const settings = settingsById.get(user.id);
		if (!settings) continue;
		if (settings.searchLocations.length === 0) {
			runs.push({ user, settings, keys: new Set() }); // no search → nothing matches
			continue;
		}
		const key = searchKey(settings);
		if (!resultsBySearch.has(key)) {
			try {
				const found = await fetchAllListings(settings);
				resultsBySearch.set(key, found);
				console.log(`Fetched ${found.length} listings from Finn for ${user.name}'s search`);
			} catch (e) {
				console.error(`Finn search for ${user.name} failed:`, e);
				resultsBySearch.set(key, null);
			}
		}
		const found = resultsBySearch.get(key) ?? null;
		for (const l of found ?? []) union.set(l.finnkode, l);
		runs.push({ user, settings, keys: found && new Set(found.map((l) => l.finnkode)) });
	}

	// 2. Upsert the listings themselves (shared by everyone), tracking price changes
	const { newKeys, dropKeys } = await upsertListings([...union.values()], now);

	// 3. Record which listings each user's search returned
	for (const run of runs) {
		if (run.keys) await updateMatches(run.user.id, [...run.keys], now);
	}
	// A listing is active while any user's search still returns it
	await db.execute(sql`
		update ${listings} set active = exists (
			select 1 from ${listingMatches} m where m.finnkode = ${listings.finnkode} and m.active
		)
	`);

	await geocodeMissing();
	for (const run of runs) await computeTravel(run.user, run.settings);
	await enrichDetails(now);

	// 4. Per-user Discord notifications
	const dropRows =
		dropKeys.length > 0
			? await db
					.select()
					.from(listings)
					.where(
						inArray(
							listings.finnkode,
							dropKeys.map((d) => d.finnkode)
						)
					)
			: [];
	for (const run of runs) {
		if (run.keys) await notifyUser(run, dropKeys, dropRows, now);
	}

	console.log(
		`Scrape done: ${union.size} listings across ${resultsBySearch.size} searches, ${newKeys.length} new, ${dropKeys.length} price drops`
	);
	return { total: union.size, added: newKeys.length };
}

type DropKey = { finnkode: string; oldPrice: number; newPrice: number };

async function upsertListings(
	fetched: FinnListing[],
	now: Date
): Promise<{ newKeys: string[]; dropKeys: DropKey[] }> {
	const existing = await db
		.select({
			finnkode: listings.finnkode,
			priceTotal: listings.priceTotal,
			priceSuggestion: listings.priceSuggestion
		})
		.from(listings);
	const existingMap = new Map(existing.map((e) => [e.finnkode, e]));

	const newKeys: string[] = [];
	// finnkodes whose effective price went down — full rows are fetched later
	const dropKeys: DropKey[] = [];

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
					lastSeenAt: now
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
	return { newKeys, dropKeys };
}

// Matches this run's results; the rest of the user's matches dropped out of their search
// (sold, withdrawn, or no longer within their criteria).
async function updateMatches(userId: number, keys: string[], now: Date): Promise<void> {
	for (let i = 0; i < keys.length; i += 500) {
		await db
			.insert(listingMatches)
			.values(
				keys
					.slice(i, i + 500)
					.map((finnkode) => ({ userId, finnkode, firstSeenAt: now, lastSeenAt: now }))
			)
			.onConflictDoUpdate({
				target: [listingMatches.userId, listingMatches.finnkode],
				set: { lastSeenAt: now, active: true }
			});
	}
	await db
		.update(listingMatches)
		.set({ active: false })
		.where(
			and(
				eq(listingMatches.userId, userId),
				eq(listingMatches.active, true),
				keys.length > 0 ? notInArray(listingMatches.finnkode, keys) : undefined
			)
		);
}

// Coordinates for any active listing that has an address but none yet
async function geocodeMissing(): Promise<void> {
	const missing = await db
		.select({ finnkode: listings.finnkode, address: listings.address })
		.from(listings)
		.where(and(isNull(listings.lat), isNotNull(listings.address), eq(listings.active, true)));
	for (const l of missing) {
		const coords = await geocodeAddress(l.address!);
		if (coords) {
			await db
				.update(listings)
				.set({ lat: coords.lat, lon: coords.lon })
				.where(eq(listings.finnkode, l.finnkode));
		}
		await pause(300);
	}
}

// Travel time from each of the user's active matches to their work address, by their mode.
// Saving a new address/mode in settings clears these, so they're recomputed here.
async function computeTravel(user: User, s: UserSettings): Promise<void> {
	if (s.workLat === null || s.workLon === null) return;
	const work = { lat: s.workLat, lon: s.workLon };
	const due = await db
		.select({ finnkode: listings.finnkode, lat: listings.lat, lon: listings.lon })
		.from(listingMatches)
		.innerJoin(listings, eq(listings.finnkode, listingMatches.finnkode))
		.where(
			and(
				eq(listingMatches.userId, user.id),
				eq(listingMatches.active, true),
				isNull(listingMatches.travelMinutes),
				isNotNull(listings.lat)
			)
		);
	let done = 0;
	for (const l of due) {
		const minutes = await travelMinutes({ lat: l.lat!, lon: l.lon! }, work, s.travelMode);
		if (minutes !== null) {
			await db
				.update(listingMatches)
				.set({ travelMinutes: minutes })
				.where(and(eq(listingMatches.userId, user.id), eq(listingMatches.finnkode, l.finnkode)));
			done++;
		}
		await pause(300);
	}
	if (due.length > 0) console.log(`Travel times for ${user.name}: ${done}/${due.length}`);
}

async function notifyUser(
	{ user, settings }: UserRun,
	dropKeys: DropKey[],
	dropRows: Listing[],
	now: Date
): Promise<void> {
	const fresh = await db
		.select({ listing: listings, travelMinutes: listingMatches.travelMinutes })
		.from(listingMatches)
		.innerJoin(listings, eq(listings.finnkode, listingMatches.finnkode))
		.where(
			and(
				eq(listingMatches.userId, user.id),
				eq(listingMatches.active, true),
				isNull(listingMatches.notifiedAt)
			)
		);
	const markNotified = () =>
		db
			.update(listingMatches)
			.set({ notifiedAt: now })
			.where(and(eq(listingMatches.userId, user.id), isNull(listingMatches.notifiedAt)));

	// First run after the search changed: everything is "new" — file it without posting
	if (settings.searchPending) {
		if (fresh.length > 0)
			console.log(
				`${user.name}'s search changed — ${fresh.length} matches marked seen, not posted`
			);
		await markNotified();
		await db.update(userSettings).set({ searchPending: false }).where(eq(userSettings.id, user.id));
		return;
	}

	const webhook = webhookFor(user);
	if (fresh.length > 0) {
		// Marked even without a webhook, so adding one later doesn't post the whole backlog
		if (webhook) {
			const withTravel = fresh
				.map((r) => ({ ...r.listing, travelMinutes: r.travelMinutes }))
				.sort((a, b) => (a.travelMinutes ?? 999) - (b.travelMinutes ?? 999));
			await notifyNewListings(webhook, withTravel);
		}
		await markNotified();
	}

	if (!webhook || dropKeys.length === 0) return;
	// Price drops among this user's current matches that they haven't hidden
	const mine = await db
		.select({
			finnkode: listingMatches.finnkode,
			travelMinutes: listingMatches.travelMinutes,
			hidden: listingUserState.hidden
		})
		.from(listingMatches)
		.leftJoin(
			listingUserState,
			and(
				eq(listingUserState.userId, listingMatches.userId),
				eq(listingUserState.finnkode, listingMatches.finnkode)
			)
		)
		.where(
			and(
				eq(listingMatches.userId, user.id),
				eq(listingMatches.active, true),
				inArray(
					listingMatches.finnkode,
					dropKeys.map((d) => d.finnkode)
				)
			)
		);
	const relevant = new Map(mine.filter((m) => !m.hidden).map((m) => [m.finnkode, m]));
	const byKey = new Map(dropRows.map((r) => [r.finnkode, r]));
	const drops: PriceDrop[] = dropKeys.flatMap((d) => {
		const listing = byKey.get(d.finnkode);
		const match = relevant.get(d.finnkode);
		return listing && match
			? [
					{
						listing: { ...listing, travelMinutes: match.travelMinutes },
						oldPrice: d.oldPrice,
						newPrice: d.newPrice
					}
				]
			: [];
	});
	if (drops.length > 0) {
		await notifyPriceDrops(webhook, drops);
		console.log(`Notified ${user.name} of ${drops.length} price drops`);
	}
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

// Detail pages cost one request each, so spread them over runs.
const DETAIL_BUDGET = 150;
// Viewings get added/changed after publication, so re-fetch relevant listings this often.
const DETAIL_REFRESH_MS = 20 * 60 * 60 * 1000;
// Refreshing every listing daily would be too many requests; viewings are mostly scheduled in
// the first couple of weeks, so only keep refreshing recent listings and the ones you follow.
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
					or(followedBySomeone, and(not(hiddenByEveryone), gt(listings.firstSeenAt, recentAfter)))
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
		await pause(800);
	}
	console.log(`Fetched details for ${ok}/${due.length} listings`);
}
