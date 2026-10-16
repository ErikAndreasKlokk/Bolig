import { sql } from 'drizzle-orm';
import { db } from './db';
import { listingUserState } from './db/schema';
import { ERIK_WORK } from './entur';
import type { ListingStatus } from '$lib/listing';

export type ListingStatePatch = Partial<{
	favorite: boolean;
	hidden: boolean;
	status: ListingStatus | null;
	note: string | null;
}>;

/** Upsert one user's tracking for a listing, touching only the fields in `patch`. */
export async function setListingState(
	userId: number,
	finnkode: string,
	patch: ListingStatePatch
): Promise<void> {
	if (Object.keys(patch).length === 0) return;
	await db
		.insert(listingUserState)
		.values({ userId, finnkode, ...patch })
		.onConflictDoUpdate({
			target: [listingUserState.userId, listingUserState.finnkode],
			set: patch
		});
}

/**
 * Before logins existed, favorite/hidden/status/note lived on `listings` and were Erik's. Copy
 * them into Erik's (user 1) rows — once: the NOT EXISTS makes it a no-op as soon as anyone has
 * tracked anything, so it's safe to run on every boot.
 */
export async function migrateLegacyListingState(): Promise<void> {
	const result = await db.execute(sql`
		insert into listing_user_state (user_id, finnkode, favorite, hidden, status, note)
		select 1, finnkode, favorite, hidden, status, note from listings
		where (favorite or hidden or status is not null or note is not null)
			and not exists (select 1 from listing_user_state)
	`);
	if (result.count > 0) console.log(`Copied ${result.count} legacy listing states to Erik`);
}

/**
 * Before per-user searches, there was one hard-coded search (Oslo + Bærum, 3–5 mill.) with travel
 * time to Erik's work, and every listing came from it. Make that Erik's search and copy the
 * listings in as his matches — keeping notified/travel state so he isn't re-notified. Runs once:
 * a no-op as soon as listing_matches has any rows.
 */
export async function migrateLegacyMatches(): Promise<void> {
	await db.transaction(async (tx) => {
		const [{ n }] = await tx.execute<{ n: number }>(
			sql`select count(*)::int as n from listing_matches`
		);
		if (n > 0) return;
		const copied = await tx.execute(sql`
			insert into listing_matches (user_id, finnkode, first_seen_at, last_seen_at, active, notified_at, travel_minutes)
			select 1, finnkode, first_seen_at, last_seen_at, active, notified_at, travel_minutes from listings
		`);
		if (copied.count === 0) return; // fresh database — nothing to carry over
		await tx.execute(sql`insert into user_settings (id) values (1) on conflict do nothing`);
		await tx.execute(sql`
			update user_settings set
				search_locations = ${JSON.stringify(['0.20061', '1.20003.20045'])}::jsonb,
				price_from = 3000000, price_to = 5000000,
				search_pending = false,
				work_address = ${ERIK_WORK.address}, work_lat = ${ERIK_WORK.lat}, work_lon = ${ERIK_WORK.lon},
				travel_mode = 'transit'
			where id = 1
		`);
		console.log(`Made the old search Erik's and copied ${copied.count} listings as his matches`);
	});
}
