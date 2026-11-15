// Per-user search criteria, shared by the settings page (client) and the scraper (server).
// Option values are hjem.no's own (the `property_type`/`owner_type` values its search sends).
import { COUNTIES } from './locations';

export const PROPERTY_TYPES = [
	{ value: 'apartment', label: 'Leilighet' },
	{ value: 'single_dwelling', label: 'Enebolig' },
	{ value: 'twin_dwelling', label: 'Tomannsbolig' },
	{ value: 'townhouse', label: 'Rekkehus' },
	{ value: 'farm', label: 'Gårdsbruk/Småbruk' },
	{ value: 'plot', label: 'Tomt' },
	{ value: 'others', label: 'Annet' }
] as const;

export const OWNERSHIP_TYPES = [
	{ value: 'freehold', label: 'Selveier' },
	{ value: 'share', label: 'Andel' },
	{ value: 'stock', label: 'Aksje' },
	{ value: 'cooperative', label: 'Obligasjon' }
] as const;

export const TRAVEL_MODES = { transit: 'Kollektivt', car: 'Bil' } as const;
export type TravelMode = keyof typeof TRAVEL_MODES;
export const TRAVEL_ICONS: Record<TravelMode, string> = { transit: '🚇', car: '🚗' };

export interface ListingSearch {
	/** Location codes from $lib/locations, e.g. "oslo" or "akershus/bærum" */
	searchLocations: string[];
	priceFrom: number | null;
	priceTo: number | null;
	propertyTypes: string[];
	ownershipTypes: string[];
	minSizeM2: number | null;
	minBedrooms: number | null;
}

const locationNames = new Map<string, string>(
	COUNTIES.flatMap((c) => [
		[c.code, c.name] as const,
		...c.children.map((m) => [m.code, m.name] as const)
	])
);

export function locationName(code: string): string {
	return locationNames.get(code) ?? code;
}

/** A county code has no "/" (municipalities and districts do). */
export const isCounty = (code: string) => !code.includes('/');

// "akershus" covers "akershus/bærum", which covers "akershus/bærum/<district>"
const covers = (outer: string, inner: string) => inner.startsWith(outer + '/');

/** Known codes only, without any already covered by a wider one that's also selected. */
export function cleanLocations(raw: string[]): string[] {
	const codes = [...new Set(raw)].filter((c) => locationNames.has(c));
	return codes.filter((c) => !codes.some((o) => covers(o, c)));
}

const mill = (n: number) =>
	(n / 1_000_000).toLocaleString('nb-NO', { maximumFractionDigits: 1 }).replace(/,0$/, '');

/** e.g. "3–5 mill. kr i Oslo og Bærum" — for subtitles. */
export function describeSearch(s: ListingSearch): string {
	if (s.searchLocations.length === 0) return 'Ingen søk satt opp ennå';
	const names = s.searchLocations.map(locationName);
	const places =
		names.length <= 3
			? names.join(', ').replace(/, ([^,]*)$/, ' og $1')
			: `${names.slice(0, 2).join(', ')} + ${names.length - 2} til`;
	let price = '';
	if (s.priceFrom && s.priceTo) price = `${mill(s.priceFrom)}–${mill(s.priceTo)} mill. kr i `;
	else if (s.priceTo) price = `under ${mill(s.priceTo)} mill. kr i `;
	else if (s.priceFrom) price = `over ${mill(s.priceFrom)} mill. kr i `;
	return price + places;
}

/** Same criteria → same results, so users with identical searches share one fetch. */
export function searchKey(s: ListingSearch): string {
	const sorted = (xs: string[]) => [...xs].sort().join(',');
	return [
		sorted(s.searchLocations),
		s.priceFrom ?? '',
		s.priceTo ?? '',
		sorted(s.propertyTypes),
		sorted(s.ownershipTypes),
		s.minSizeM2 ?? '',
		s.minBedrooms ?? ''
	].join('|');
}
