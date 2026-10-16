// Per-user Finn search criteria, shared by the settings page (client) and the scraper (server).
// Option values are Finn's own, read from the filter data on finn.no/realestate/homes/search.html.
import { FINN_COUNTIES } from './locations';

export const PROPERTY_TYPES = [
	{ value: '3', label: 'Leilighet' },
	{ value: '1', label: 'Enebolig' },
	{ value: '2', label: 'Tomannsbolig' },
	{ value: '4', label: 'Rekkehus' },
	{ value: '11', label: 'Gårdsbruk/Småbruk' },
	{ value: '20', label: 'Bygård/Flermannsbolig' },
	{ value: '18', label: 'Andre' }
] as const;

export const OWNERSHIP_TYPES = [
	{ value: '3', label: 'Selveier' },
	{ value: '4', label: 'Andel' },
	{ value: '2', label: 'Aksje' },
	{ value: '1', label: 'Obligasjon' }
] as const;

export const TRAVEL_MODES = { transit: 'Kollektivt', car: 'Bil' } as const;
export type TravelMode = keyof typeof TRAVEL_MODES;
export const TRAVEL_ICONS: Record<TravelMode, string> = { transit: '🚇', car: '🚗' };

export interface FinnSearch {
	searchLocations: string[];
	priceFrom: number | null;
	priceTo: number | null;
	propertyTypes: string[];
	ownershipTypes: string[];
	minSizeM2: number | null;
	minBedrooms: number | null;
}

const locationNames = new Map<string, string>(
	FINN_COUNTIES.flatMap((c) => [
		[c.code, c.name] as const,
		...c.children.map((m) => [m.code, m.name] as const)
	])
);

export function locationName(code: string): string {
	return locationNames.get(code) ?? code;
}

const mill = (n: number) =>
	(n / 1_000_000).toLocaleString('nb-NO', { maximumFractionDigits: 1 }).replace(/,0$/, '');

/** e.g. "3–5 mill. kr i Oslo og Bærum" — for subtitles. */
export function describeSearch(s: FinnSearch): string {
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

/** Same criteria → same Finn results, so users with identical searches share one fetch. */
export function searchKey(s: FinnSearch): string {
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
