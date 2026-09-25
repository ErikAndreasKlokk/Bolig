// Listing types/constants shared by server and client (no server-only imports here).

export interface Viewing {
	start: string; // ISO timestamp (UTC)
	end: string | null;
	calendarUrl: string | null;
}

export interface ListingImage {
	url: string;
	caption: string | null;
}

/** A label/value row from the ad's key facts or price details, e.g. "Byggeår" / "2003". */
export interface ListingFact {
	label: string;
	value: string;
}

/** Extra detail loaded on demand for the listing drawer (see /api/listing/[finnkode]). */
export interface ListingDetail {
	images: ListingImage[];
	facts: ListingFact[];
	description: string | null;
	facilities: string[];
	history: { price: number; at: string }[];
}

export const LISTING_STATUSES = ['interessert', 'visning', 'budt', 'avslatt'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const STATUS_LABELS: Record<ListingStatus, string> = {
	interessert: 'Interessert',
	visning: 'Visning booket',
	budt: 'Budt',
	avslatt: 'Avslått'
};

export function isListingStatus(s: unknown): s is ListingStatus {
	return typeof s === 'string' && (LISTING_STATUSES as readonly string[]).includes(s);
}

/**
 * Area used for grouping/filtering: Finn's bydel (from the detail page) when known. Before the
 * details are fetched, the address' post town still tells Bærum apart (the search only covers
 * Oslo + Bærum, and Oslo addresses end in "Oslo").
 */
export function areaOf(l: { district: string | null; localArea: string | null }): string | null {
	if (l.district) return l.district;
	if (l.localArea && l.localArea !== 'Oslo') return 'Bærum';
	return null;
}

/** Viewings that haven't ended yet, soonest first. */
export function upcomingViewings(viewings: Viewing[] | null, now = new Date()): Viewing[] {
	return (viewings ?? [])
		.filter((v) => new Date(v.end ?? v.start).getTime() >= now.getTime())
		.sort((a, b) => a.start.localeCompare(b.start));
}

// Always render in Oslo time — the server container has no tzdata, but Intl carries its own.
const dayFmt = new Intl.DateTimeFormat('nb-NO', {
	timeZone: 'Europe/Oslo',
	weekday: 'short',
	day: 'numeric',
	month: 'short'
});
const timeFmt = new Intl.DateTimeFormat('nb-NO', {
	timeZone: 'Europe/Oslo',
	hour: '2-digit',
	minute: '2-digit'
});

/** e.g. "søn. 27. sep. 12:00–12:45" */
export function formatViewing(v: Viewing): string {
	const start = new Date(v.start);
	const time = timeFmt.format(start) + (v.end ? `–${timeFmt.format(new Date(v.end))}` : '');
	return `${dayFmt.format(start)} ${time}`;
}

/** Effective price: totalpris when known, else prisantydning. */
export function effectivePrice(l: {
	priceTotal: number | null;
	priceSuggestion: number | null;
}): number | null {
	return l.priceTotal ?? l.priceSuggestion;
}

export function pricePerM2(l: {
	priceTotal: number | null;
	priceSuggestion: number | null;
	sizeM2: number | null;
}): number | null {
	const price = effectivePrice(l);
	return price && l.sizeM2 ? Math.round(price / l.sizeM2) : null;
}
