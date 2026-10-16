import { eq, asc, and, or, inArray, isNotNull, getTableColumns, sql, type SQL } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { listingMatches, listings, listingUserState, priceHistory } from '$lib/server/db/schema';
import { describeSearch, TRAVEL_MODES } from '$lib/search';
import { getSettings } from '$lib/server/settings';
import { requireUser } from '$lib/server/auth';
import { setListingState, type ListingStatePatch } from '$lib/server/userState';
import { computeAffordability, type Affordability } from '$lib/affordability';
import {
	areaOf,
	effectivePrice,
	isListingStatus,
	pricePerM2,
	upcomingViewings,
	type Viewing
} from '$lib/listing';
import type { Actions, PageServerLoad } from './$types';

const SORTS = {
	reise: 'Reisetid',
	pris: 'Pris',
	kvmpris: 'Kr/m²',
	mnd: 'Månedskostnad',
	storrelse: 'Størrelse',
	nyeste: 'Nyeste'
} as const;
type Sort = keyof typeof SORTS;

function intParam(url: URL, key: string): number | null {
	const v = url.searchParams.get(key);
	if (!v) return null;
	const n = Number(v.replace(/\s/g, ''));
	return Number.isFinite(n) && n > 0 ? n : null;
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const user = requireUser(locals);
	const showHidden = url.searchParams.get('hidden') === '1';
	const showInactive = url.searchParams.get('inactive') === '1';
	const onlyAffordable = url.searchParams.get('affordable') === '1';
	const view = url.searchParams.get('view') === 'kart' ? 'kart' : 'liste';
	const sortParam = url.searchParams.get('sort') ?? 'reise';
	const sort: Sort = sortParam in SORTS ? (sortParam as Sort) : 'reise';
	const filters = {
		area: url.searchParams.get('area') || null,
		type: url.searchParams.get('type') || null,
		status: url.searchParams.get('status') || null,
		minBedrooms: intParam(url, 'minBedrooms'),
		minSize: intParam(url, 'minSize'),
		maxPrice: intParam(url, 'maxPrice'),
		maxShared: intParam(url, 'maxShared'),
		maxTravel: intParam(url, 'maxTravel')
	};

	// The logged-in user's own tracking; no row means untouched
	const favorite = sql<boolean>`coalesce(${listingUserState.favorite}, false)`;
	const hidden = sql<boolean>`coalesce(${listingUserState.hidden}, false)`;
	// "Active" for you = still returned by *your* search (gone = sold, or now outside your criteria)
	const active = sql<boolean>`coalesce(${listingMatches.active}, false)`;

	// Only listings your own search has found…
	const conditions: SQL[] = [isNotNull(listingMatches.userId)];
	if (!showHidden) conditions.push(sql`not ${hidden}`);
	if (!showInactive) conditions.push(active);

	// …but favorites stay pinned even after they go inactive (sold / dropped off Finn) or get
	// hidden, so a listing you starred doesn't silently vanish the next day.
	const visibility = or(favorite, and(...conditions));

	// Images, facts and description are only needed in the drawer, which loads them on demand
	// (/api/listing/[finnkode]) — leave them out of this ~900-row query. The legacy single-user
	// columns are replaced by the joined per-user ones.
	/* eslint-disable @typescript-eslint/no-unused-vars -- destructured only to leave them out */
	const {
		images: _images,
		facts: _facts,
		description: _description,
		facilities: _facilities,
		favorite: _favorite,
		hidden: _hidden,
		status: _status,
		note: _note,
		travelMinutes: _travelMinutes,
		notifiedAt: _notifiedAt,
		active: _active,
		firstSeenAt: _firstSeenAt,
		...cardColumns
	} = getTableColumns(listings);
	/* eslint-enable @typescript-eslint/no-unused-vars */
	const rows = await db
		.select({
			...cardColumns,
			active,
			// When it showed up in your search, for "Nyeste"
			firstSeenAt:
				sql<Date>`coalesce(${listingMatches.firstSeenAt}, ${listings.firstSeenAt})`.mapWith(
					listings.firstSeenAt
				),
			travelMinutes: listingMatches.travelMinutes,
			favorite,
			hidden,
			status: listingUserState.status,
			note: listingUserState.note
		})
		.from(listings)
		.leftJoin(
			listingUserState,
			and(eq(listingUserState.finnkode, listings.finnkode), eq(listingUserState.userId, user.id))
		)
		.leftJoin(
			listingMatches,
			and(eq(listingMatches.finnkode, listings.finnkode), eq(listingMatches.userId, user.id))
		)
		.where(visibility);
	const settings = await getSettings(user.id);

	const all = rows.map((l) => ({
		...l,
		district: areaOf(l),
		afford: computeAffordability(l, settings) as Affordability | null,
		pricePerM2: pricePerM2(l),
		upcoming: upcomingViewings(l.viewings)
	}));

	// Dropdown options come from everything visible, before the user's own filters
	const areas = [...new Set(all.map((l) => l.district).filter((a): a is string => !!a))].sort(
		(a, b) => a.localeCompare(b, 'nb')
	);
	const types = [...new Set(all.map((l) => l.propertyType).filter((t): t is string => !!t))].sort(
		(a, b) => a.localeCompare(b, 'nb')
	);

	// Upcoming viewings for listings you care about, regardless of the filters below
	const agenda = all
		.filter((l) => l.active && (l.favorite || (l.status && l.status !== 'avslatt')))
		.flatMap((l) =>
			l.upcoming.map((v: Viewing) => ({
				viewing: v,
				finnkode: l.finnkode,
				heading: l.heading,
				address: l.address,
				status: l.status,
				listing: l
			}))
		)
		.sort((a, b) => a.viewing.start.localeCompare(b.viewing.start))
		.slice(0, 12);

	const f = filters;
	const filtered = all.filter((l) => {
		if (onlyAffordable && !(l.afford && l.afford.level !== 'red')) return false;
		if (f.area && l.district !== f.area) return false;
		if (f.type && l.propertyType !== f.type) return false;
		if (f.status === 'aktiv' && !(l.status && l.status !== 'avslatt')) return false;
		if (f.status && f.status !== 'aktiv' && l.status !== f.status) return false;
		// Unknown values pass numeric filters — bedrooms/travel aren't known until enrichment
		if (f.minBedrooms && l.bedrooms !== null && l.bedrooms < f.minBedrooms) return false;
		if (f.minSize && l.sizeM2 !== null && l.sizeM2 < f.minSize) return false;
		const price = effectivePrice(l);
		if (f.maxPrice && price !== null && price > f.maxPrice) return false;
		if (f.maxShared && l.sharedCost !== null && l.sharedCost > f.maxShared) return false;
		if (f.maxTravel && l.travelMinutes !== null && l.travelMinutes > f.maxTravel) return false;
		return true;
	});

	// Nulls last, favorites always on top
	const key: Record<Sort, (l: (typeof all)[number]) => number | null> = {
		reise: (l) => l.travelMinutes,
		pris: (l) => effectivePrice(l),
		kvmpris: (l) => l.pricePerM2,
		mnd: (l) => (l.afford ? l.afford.totalMonthly : null),
		storrelse: (l) => (l.sizeM2 !== null ? -l.sizeM2 : null),
		nyeste: (l) => -l.firstSeenAt.getTime()
	};
	const k = key[sort];
	filtered.sort((a, b) => {
		if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
		const ka = k(a);
		const kb = k(b);
		if (ka === null && kb === null) return 0;
		if (ka === null) return 1;
		if (kb === null) return -1;
		return ka - kb;
	});

	// Price history (effective price = totalpris, else prisantydning) per listing, oldest first
	const keys = filtered.map((l) => l.finnkode);
	const historyByKey = new Map<string, number[]>();
	// Wide screens show the list next to the map, so this is needed in both views
	if (keys.length > 0) {
		const hist = await db
			.select({
				finnkode: priceHistory.finnkode,
				priceTotal: priceHistory.priceTotal,
				priceSuggestion: priceHistory.priceSuggestion
			})
			.from(priceHistory)
			.where(inArray(priceHistory.finnkode, keys))
			.orderBy(asc(priceHistory.recordedAt));
		for (const h of hist) {
			const price = h.priceTotal ?? h.priceSuggestion;
			if (price === null) continue;
			const arr = historyByKey.get(h.finnkode);
			if (arr) arr.push(price);
			else historyByKey.set(h.finnkode, [price]);
		}
	}

	const withHistory = filtered.map((l) => ({
		...l,
		priceHistory: historyByKey.get(l.finnkode) ?? []
	}));

	return {
		user: { key: user.key, name: user.name },
		searchSummary: describeSearch(settings),
		hasSearch: settings.searchLocations.length > 0,
		travelSummary: settings.workAddress
			? `${TRAVEL_MODES[settings.travelMode].toLowerCase()} til ${settings.workAddress}`
			: null,
		listings: withHistory,
		settings,
		showHidden,
		showInactive,
		onlyAffordable,
		view,
		sort,
		sorts: SORTS,
		filters,
		areas,
		types,
		agenda
	};
};

export const actions: Actions = {
	hide: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const finnkode = String(data.get('finnkode'));
		await setListingState(user.id, finnkode, { hidden: data.get('hidden') === 'true' });
	},
	favorite: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const finnkode = String(data.get('finnkode'));
		await setListingState(user.id, finnkode, { favorite: data.get('favorite') === 'true' });
	},
	track: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const finnkode = String(data.get('finnkode'));
		// Status and note are saved from separate forms — only touch the fields that were sent
		const patch: ListingStatePatch = {};
		if (data.has('status')) {
			const status = data.get('status') || null;
			if (status !== null && !isListingStatus(status))
				return fail(400, { error: 'Ugyldig status' });
			patch.status = status;
		}
		if (data.has('note')) patch.note = String(data.get('note')).trim().slice(0, 5000) || null;
		await setListingState(user.id, finnkode, patch);
	}
};
