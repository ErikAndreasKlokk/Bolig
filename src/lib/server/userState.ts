import { sql } from 'drizzle-orm';
import { db } from './db';
import { listingUserState } from './db/schema';
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
