// Moving from Finn to hjem.no (Nov 2026). Both pieces are safe to run repeatedly.
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from './db';
import { listingUserState, userSettings } from './db/schema';
import { FINN_TO_HJEM_LOCATION } from './finnLocationMap';
import { cleanLocations } from '$lib/search';

const FINN_PROPERTY_TYPE: Record<string, string> = {
	'3': 'apartment', // Leilighet
	'1': 'single_dwelling', // Enebolig
	'2': 'twin_dwelling', // Tomannsbolig
	'4': 'townhouse', // Rekkehus
	'11': 'farm', // Gårdsbruk/Småbruk
	'20': 'others', // Bygård/Flermannsbolig — hjem.no has no such home type
	'18': 'others' // Andre
};

const FINN_OWNERSHIP_TYPE: Record<string, string> = {
	'3': 'freehold', // Selveier
	'4': 'share', // Andel
	'2': 'stock', // Aksje
	'1': 'cooperative' // Obligasjon
};

const isFinnLocation = (code: string) => /^[01]\.\d/.test(code);
const isFinnOption = (v: string) => /^\d+$/.test(v);

/**
 * Translate each saved search from Finn's codes to hjem.no's. Also marks the search as changed,
 * so the first hjem.no scrape files everything it finds as seen: every hjem.no listing is new
 * to us, and posting them all to Discord would be hundreds of messages.
 */
export async function migrateFinnSearches(): Promise<void> {
	const rows = await db.select().from(userSettings);
	for (const s of rows) {
		const finn =
			s.searchLocations.some(isFinnLocation) ||
			s.propertyTypes.some(isFinnOption) ||
			s.ownershipTypes.some(isFinnOption);
		if (!finn) continue;

		const dropped = s.searchLocations.filter((c) => isFinnLocation(c) && !FINN_TO_HJEM_LOCATION[c]);
		const searchLocations = cleanLocations(
			s.searchLocations
				.map((c) => (isFinnLocation(c) ? FINN_TO_HJEM_LOCATION[c] : c))
				.filter(Boolean)
		);
		const mapOptions = (vs: string[], table: Record<string, string>) => [
			...new Set(vs.map((v) => (isFinnOption(v) ? table[v] : v)).filter(Boolean))
		];
		await db
			.update(userSettings)
			.set({
				searchLocations,
				propertyTypes: mapOptions(s.propertyTypes, FINN_PROPERTY_TYPE),
				ownershipTypes: mapOptions(s.ownershipTypes, FINN_OWNERSHIP_TYPE),
				searchPending: true
			})
			.where(eq(userSettings.id, s.id));
		console.log(
			`Moved user ${s.id}'s search to hjem.no: ${s.searchLocations.join(',')} → ${searchLocations.join(',')}` +
				(dropped.length ? ` (no hjem.no area for ${dropped.join(',')})` : '')
		);
	}
}

// Same home on both sites: street address without spaces/case, plus the post town
const homeKey = (alias: string) =>
	sql.raw(
		`regexp_replace(lower(split_part(${alias}.address, ',', 1)), '\\s', '', 'g') || '|' || lower(coalesce(${alias}.local_area, ''))`
	);

/**
 * Carry each user's favorite/status/note/hidden over from a Finn listing to the same home on
 * hjem.no, the first time we see it. The favorite moves rather than copies, so the home isn't
 * pinned twice; the Finn row keeps its note/status as history.
 */
export async function carryOverFinnState(newKeys: string[]): Promise<void> {
	let carried = 0;
	for (let i = 0; i < newKeys.length; i += 500) {
		const batch = newKeys.slice(i, i + 500);
		// hjem.no listing → the most recently seen Finn listing at the same address
		const pairs = await db.execute<{ hjem: string; finn: string }>(sql`
			select distinct on (h.finnkode) h.finnkode as hjem, f.finnkode as finn
			from listings h
			join listings f on f.finnkode ~ '^[0-9]{1,12}$' and f.address is not null
				and ${homeKey('f')} = ${homeKey('h')}
			where h.finnkode in ${batch} and h.address is not null
			order by h.finnkode, f.last_seen_at desc
		`);
		if (pairs.length === 0) continue;
		const hjemOf = new Map(pairs.map((p) => [p.finn, p.hjem]));
		const states = await db
			.select()
			.from(listingUserState)
			.where(inArray(listingUserState.finnkode, [...hjemOf.keys()]));

		for (const s of states) {
			if (!s.favorite && !s.hidden && s.status === null && s.note === null) continue;
			const inserted = await db
				.insert(listingUserState)
				.values({ ...s, finnkode: hjemOf.get(s.finnkode)! })
				.onConflictDoNothing()
				.returning({ userId: listingUserState.userId });
			if (inserted.length === 0) continue; // they already track the hjem.no one
			carried++;
			if (s.favorite)
				await db
					.update(listingUserState)
					.set({ favorite: false })
					.where(
						and(eq(listingUserState.userId, s.userId), eq(listingUserState.finnkode, s.finnkode))
					);
		}
	}
	if (carried > 0) console.log(`Carried ${carried} Finn favorites/notes/statuses over to hjem.no`);
}
