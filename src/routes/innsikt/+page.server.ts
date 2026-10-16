import { and, asc, eq, min } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { listingMatches, listings, listingUserState, priceHistory } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/auth';
import { areaOf, effectivePrice, pricePerM2 } from '$lib/listing';
import type { PageServerLoad } from './$types';

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_DAYS = 90;

function median(xs: number[]): number | null {
	if (xs.length === 0) return null;
	const s = [...xs].sort((a, b) => a - b);
	const mid = s.length >> 1;
	return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	// The market your own search covers. "Gone" means gone from Finn (no search returns it any
	// more), not just out of your criteria — so active/lastSeenAt come from the listing itself.
	const rows = (
		await db
			.select({ listing: listings, firstSeenAt: listingMatches.firstSeenAt })
			.from(listingMatches)
			.innerJoin(listings, eq(listings.finnkode, listingMatches.finnkode))
			.where(eq(listingMatches.userId, user.id))
	).map((r) => ({ ...r.listing, firstSeenAt: r.firstSeenAt }));
	const favorites = new Set(
		(
			await db
				.select({ finnkode: listingUserState.finnkode })
				.from(listingUserState)
				.where(and(eq(listingUserState.userId, user.id), eq(listingUserState.favorite, true)))
		).map((r) => r.finnkode)
	);
	const [{ trackingStart }] = await db
		.select({ trackingStart: min(listingMatches.firstSeenAt) })
		.from(listingMatches)
		.where(eq(listingMatches.userId, user.id));

	// First and last observed price per listing
	const hist = await db
		.select({
			finnkode: priceHistory.finnkode,
			priceTotal: priceHistory.priceTotal,
			priceSuggestion: priceHistory.priceSuggestion
		})
		.from(priceHistory)
		.orderBy(asc(priceHistory.recordedAt));
	const firstPrice = new Map<string, number>();
	for (const h of hist) {
		const p = h.priceTotal ?? h.priceSuggestion;
		if (p !== null && !firstPrice.has(h.finnkode)) firstPrice.set(h.finnkode, p);
	}

	// Listings already on Finn when tracking began have an unknown start date, so their
	// time on market is only a lower bound — flag them and keep them out of the medians.
	const censoredBefore = trackingStart ? trackingStart.getTime() + 2 * 60 * 60 * 1000 : 0;
	const now = Date.now();

	const enriched = rows.map((l) => {
		const end = l.active ? now : l.lastSeenAt.getTime();
		const price = effectivePrice(l);
		const first = firstPrice.get(l.finnkode) ?? null;
		return {
			finnkode: l.finnkode,
			heading: l.heading,
			address: l.address,
			district: areaOf(l) ?? 'Ukjent område',
			url: l.url,
			active: l.active,
			favorite: favorites.has(l.finnkode),
			sizeM2: l.sizeM2,
			price,
			pricePerM2: pricePerM2(l),
			priceChange: price !== null && first !== null ? price - first : null,
			lastSeenAt: l.lastSeenAt,
			daysOnMarket: Math.max(0, Math.round((end - l.firstSeenAt.getTime()) / DAY_MS)),
			censored: l.firstSeenAt.getTime() < censoredBefore
		};
	});

	const recentCutoff = now - RECENT_DAYS * DAY_MS;
	const removedRecent = enriched.filter((l) => !l.active && l.lastSeenAt.getTime() >= recentCutoff);
	const active = enriched.filter((l) => l.active);
	const dom = (xs: typeof enriched) =>
		median(xs.filter((l) => !l.censored).map((l) => l.daysOnMarket));
	const ppm = (xs: typeof enriched) =>
		median(xs.map((l) => l.pricePerM2).filter((x): x is number => x !== null));

	const byDistrict = new Map<string, typeof enriched>();
	for (const l of enriched) {
		const arr = byDistrict.get(l.district);
		if (arr) arr.push(l);
		else byDistrict.set(l.district, [l]);
	}

	const districts = [...byDistrict.entries()]
		.map(([name, ls]) => {
			const act = ls.filter((l) => l.active);
			const gone = ls.filter((l) => !l.active && l.lastSeenAt.getTime() >= recentCutoff);
			return {
				name,
				active: act.length,
				removed: gone.length,
				medianDays: dom(gone),
				medianPpmActive: ppm(act),
				medianPpmRemoved: ppm(gone),
				dropShare:
					ls.length > 0
						? ls.filter((l) => l.priceChange !== null && l.priceChange < 0).length / ls.length
						: 0
			};
		})
		.filter((d) => d.active + d.removed > 0)
		.sort((a, b) => b.active + b.removed - (a.active + a.removed));

	const recent = [...removedRecent]
		.sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
		.slice(0, 40);

	return {
		trackingStart,
		recentDays: RECENT_DAYS,
		summary: {
			active: active.length,
			removed: removedRecent.length,
			medianDays: dom(removedRecent),
			medianPpm: ppm(active),
			withDrop: active.filter((l) => l.priceChange !== null && l.priceChange < 0).length
		},
		districts,
		recent
	};
};
