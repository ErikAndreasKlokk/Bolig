// hjem.no listings. The site is a single-page app backed by a JSON API (the same calls its own
// search page makes); nothing here is documented, so field meanings are read off real responses.
import type { ListingFact, ListingImage, Viewing } from '$lib/listing';
import { COUNTIES } from '$lib/locations';
import type { ListingSearch } from '$lib/search';

const API = 'https://apigw.hjem.no/search-backend';
const HEADERS = {
	'User-Agent': 'bolig/1.0 (personal home-search tool)',
	Origin: 'https://hjem.no',
	Accept: 'application/json'
};
// The API refuses larger pages ("max page size is 100")
const PAGE_SIZE = 100;

/** What the scraper stores per listing; `finnkode` is our listing key (here: hjem.no's id). */
export interface SourceListing {
	finnkode: string;
	heading: string;
	address: string | null;
	localArea: string | null;
	priceTotal: number | null;
	priceSuggestion: number | null;
	sharedCost: number | null;
	sizeM2: number | null;
	bedrooms: number | null;
	propertyType: string | null;
	ownerType: string | null;
	lat: number | null;
	lon: number | null;
	url: string;
	imageUrl: string | null;
	images: ListingImage[];
	viewings: Viewing[];
	publishedAt: Date | null;
	/** Oslo's bydel, known from which per-bydel search found it (see fetchAllListings) */
	district: string | null;
}

export interface SourceDetails {
	district: string | null;
	bedrooms: number | null;
	rooms: number | null;
	floor: number | null;
	constructionYear: number | null;
	viewings: Viewing[];
	images: ListingImage[];
	facts: ListingFact[];
	description: string | null;
	facilities: string[];
}

/** hjem.no is refusing our requests as a whole, so further ones this run would be refused too. */
export class SourceBlockedError extends Error {}

// --- Response shapes (only the fields we read) ---

interface Money {
	amount: number | null;
}
interface Measure {
	value: number | null;
}
interface HjemViewing {
	unix_timestamp_time_from: number | null;
	unix_timestamp_time_to: number | null;
}
interface HjemImage {
	url: string;
	description: string | null;
}
interface HjemProperty {
	id: string;
	title: string | null;
	publish_date: string | null;
	status: string;
	type: string[] | null;
	owner_type: string | null;
	address: {
		display_name: string | null;
		postal_place: string | null;
		region?: string | null;
		suburb?: string | null;
		area?: string | null;
	};
	agency: { id: number | null } | null;
	location: { lat: number | null; lng: number | null } | null;
	prices: Partial<
		Record<
			| 'asking_price'
			| 'total_price'
			| 'shared_cost'
			| 'adding_cost'
			| 'joint_debt'
			| 'annual_property_tax'
			| 'annual_municipality_fees',
			Money
		>
	>;
	details: Partial<
		Record<
			| 'bedrooms'
			| 'bathrooms'
			| 'primary_room'
			| 'usage_area'
			| 'floor_size'
			| 'plot_area'
			| 'land_size'
			| 'floor'
			| 'total_rooms',
			Measure
		>
	> & { area_measurement?: { internal?: Measure } };
	images: HjemImage[] | null;
	viewing_date: HjemViewing[] | null;
	// Detail endpoint only
	construction_year?: number | null;
	description?: { plain: string | null; html: string | null } | null;
	facilities?: string[] | null;
	land_registry?: { housing_association?: { name: string | null } | null } | null;
}

interface HjemPage {
	success: boolean;
	data: HjemProperty[];
	pagination: { current_page: number; last_page: number; results: number };
}

// --- Labels (Norwegian, as hjem.no shows them) ---

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
	apartment: 'Leilighet',
	single_dwelling: 'Enebolig',
	twin_dwelling: 'Tomannsbolig',
	townhouse: 'Rekkehus',
	farm: 'Gårdsbruk/Småbruk',
	plot: 'Tomt',
	cabin: 'Hytte',
	leisure: 'Fritidsbolig',
	garage_parking: 'Garasje/Parkering',
	others: 'Annet'
};

export const OWNER_TYPE_LABELS: Record<string, string> = {
	freehold: 'Selveier',
	condominium: 'Selveier',
	share: 'Andel',
	stock: 'Aksje',
	cooperative: 'Obligasjon',
	other: 'Annet'
};

const FACILITY_LABELS: Record<string, string> = {
	balcony: 'Balkong/Terrasse',
	elevator: 'Heis',
	garageParking: 'Garasje/Parkering',
	parking: 'Parkering',
	guestParking: 'Gjesteparkering',
	fireplace: 'Peis/Ildsted',
	evCharging: 'Lademulighet',
	view: 'Utsikt',
	garden: 'Hage',
	quietArea: 'Rolig',
	childrenFriendly: 'Barnevennlig',
	broadbandConnection: 'Bredbånd',
	cableTv: 'Kabel-TV',
	modern: 'Moderne',
	hiking: 'Turterreng',
	caretakerServices: 'Vaktmestertjenester',
	janitorServices: 'Vaktmestertjenester',
	sharedReception: 'Felles resepsjon',
	ventilation: 'Balansert ventilasjon',
	petAllowed: 'Husdyr',
	bathingPosibility: 'Bademuligheter',
	swimmingPossibility: 'Svømmemuligheter',
	fishing: 'Fiske',
	fishingOpportunity: 'Fiskemuligheter',
	alpine: 'Alpinanlegg',
	boatBerth: 'Båtplass',
	beachLine: 'Strandlinje',
	publicWaterAndSewage: 'Offentlig vann/kloakk',
	waterSystem: 'Innlagt vann',
	electricity: 'Innlagt strøm',
	carToDoor: 'Bilvei frem',
	golf: 'Golfbane',
	dishwasher: 'Oppvaskmaskin',
	refrigerator: 'Kjøleskap/Fryser',
	furnished: 'Møblert',
	semiFurnished: 'Delvis møblert',
	expansionPossibilities: 'Utvidelsesmuligheter',
	central: 'Sentralt',
	parquet: 'Parkett',
	noReturnees: 'Ingen gjenboere',
	sharedLaundry: 'Felles vaskerom',
	other: 'Annet'
};

// "garageParking" → "Garage parking", for facilities hjem.no adds later
const humanize = (key: string) =>
	key
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/_/g, ' ')
		.toLowerCase()
		.replace(/^./, (c) => c.toUpperCase());

const placeNames = new Map(
	COUNTIES.flatMap((c) => [
		[c.code, c.name] as const,
		...c.children.map((p) => [p.code, p.name] as const)
	])
);

// --- Helpers ---

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, { ...init, headers: { ...HEADERS, ...init?.headers } });
	if (res.status === 401 || res.status === 403 || res.status === 429) {
		const body = await res.text().catch(() => '(could not read body)');
		console.warn('hjem.no refused the request:', { status: res.status, body: body.slice(0, 500) });
		throw new SourceBlockedError(`hjem.no refused the request: ${res.status} ${res.statusText}`);
	}
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`hjem.no ${url} failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
	}
	return (await res.json()) as T;
}

/** A positive number, else null — hjem.no fills unknown measures with 0 as often as with null. */
const pos = (n: number | null | undefined): number | null =>
	typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
const posInt = (n: number | null | undefined): number | null => {
	const p = pos(n);
	return p === null ? null : Math.round(p);
};

/** hjem.no's own ad page: /property/<agency id, 6 digits>/<listing id> */
function adUrl(p: HjemProperty): string {
	let agency = String(p.agency?.id ?? '').replace(/^0+/, '0');
	if (!agency || agency === '-1' || agency === '0')
		agency = '287955'; // the site's own fallback
	else agency = agency.slice(-6).padStart(6, '0');
	return `https://hjem.no/property/${agency}/${p.id}`;
}

// Strip C0 control characters incl. NUL — Postgres rejects them in text columns
const clean = (s: string) =>
	s
		.split('')
		.filter((ch) => {
			const cc = ch.charCodeAt(0);
			return cc >= 32 || cc === 9 || cc === 10 || cc === 13;
		})
		.join('');

function decodeEntities(s: string): string {
	return s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
		.replace(/&amp;/g, '&');
}

// The description's `html` is entity-encoded HTML (`&lt;br/&gt;`), and even `plain` carries tags
function htmlToText(raw: string): string {
	let html = decodeEntities(raw);
	if (/&lt;|&gt;/.test(html)) html = decodeEntities(html); // sometimes encoded twice
	return clean(
		decodeEntities(
			html
				.replace(/<br\s*\/?>/gi, '\n')
				.replace(/<\/(p|div|h\d|li)>/gi, '\n')
				.replace(/<li[^>]*>/gi, '• ')
				.replace(/<[^>]*>/g, '')
		)
	)
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function viewingsOf(p: HjemProperty): Viewing[] {
	const out: Viewing[] = [];
	for (const v of p.viewing_date ?? []) {
		if (!v.unix_timestamp_time_from) continue;
		// The start carries stray seconds (13:30:43); round down to the minute
		const startMs = Math.floor(v.unix_timestamp_time_from / 60) * 60_000;
		const endMs = v.unix_timestamp_time_to ? v.unix_timestamp_time_to * 1000 : null;
		const start = new Date(startMs).toISOString();
		if (out.some((o) => o.start === start)) continue;
		out.push({
			start,
			end: endMs && endMs > startMs ? new Date(endMs).toISOString() : null,
			calendarUrl: null
		});
	}
	return out;
}

const imagesOf = (p: HjemProperty): ListingImage[] =>
	(p.images ?? []).slice(0, 80).map((img) => ({
		url: img.url,
		caption: img.description ? clean(img.description).trim() || null : null
	}));

/** "2026-02-09 23:00:00.000000000" (UTC, nanoseconds) or ISO */
function parseDate(s: string | null): Date | null {
	if (!s) return null;
	const d = new Date(
		s.replace(' ', 'T').replace(/\.(\d{3})\d*/, '.$1') + (/[zZ+]/.test(s) ? '' : 'Z')
	);
	return isNaN(d.getTime()) ? null : d;
}

function sizeOf(p: HjemProperty): number | null {
	const d = p.details ?? {};
	return posInt(
		pos(d.primary_room?.value) ??
			pos(d.area_measurement?.internal?.value) ??
			pos(d.usage_area?.value) ??
			pos(d.floor_size?.value)
	);
}

function toListing(p: HjemProperty): SourceListing {
	const images = imagesOf(p);
	const type = p.type?.[0] ?? null;
	return {
		finnkode: p.id,
		heading: clean(p.title?.trim() || '(uten tittel)'),
		address: p.address?.display_name ? clean(p.address.display_name) : null,
		localArea: p.address?.postal_place ?? null,
		priceTotal: posInt(p.prices?.total_price?.amount),
		priceSuggestion: posInt(p.prices?.asking_price?.amount),
		sharedCost: posInt(p.prices?.shared_cost?.amount),
		sizeM2: sizeOf(p),
		bedrooms: posInt(p.details?.bedrooms?.value),
		propertyType: type ? (PROPERTY_TYPE_LABELS[type] ?? humanize(type)) : null,
		ownerType: p.owner_type ? (OWNER_TYPE_LABELS[p.owner_type] ?? humanize(p.owner_type)) : null,
		lat: p.location?.lat ?? null,
		lon: p.location?.lng ?? null,
		url: adUrl(p),
		imageUrl: images[0]?.url ?? null,
		images,
		viewings: viewingsOf(p),
		publishedAt: parseDate(p.publish_date),
		district: null
	};
}

// --- Search ---

function searchBody(s: ListingSearch, codes: string[], page: number): Record<string, unknown> {
	const body: Record<string, unknown> = {
		listing_type: 'residential_sale',
		availability: ['available'],
		// Paging by publish date (or relevance) repeats and skips listings across pages; creation
		// time is unique enough to page through stably
		sorting: 'created_at',
		order: 'desc',
		size: PAGE_SIZE,
		page,
		address: codes.map((code) => code.split('/'))
	};
	if (s.priceFrom) body.total_price_min = s.priceFrom;
	if (s.priceTo) body.total_price_max = s.priceTo;
	if (s.propertyTypes.length) body.property_type = s.propertyTypes;
	if (s.ownershipTypes.length) body.owner_type = s.ownershipTypes;
	if (s.minSizeM2) body.primary_room_min = s.minSizeM2;
	if (s.minBedrooms) body.bedroom_min = s.minBedrooms;
	return body;
}

const pause = () => new Promise((r) => setTimeout(r, 1000));

async function fetchPages(
	search: ListingSearch,
	codes: string[],
	maxPages: number
): Promise<SourceListing[]> {
	const all: SourceListing[] = [];
	for (let page = 1; ; page++) {
		const res = await getJson<HjemPage>(`${API}/api/v4/property/search`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(searchBody(search, codes, page))
		});
		all.push(
			...res.data
				.filter((p) => p.status === 'available')
				.map(toListing)
				// The price filter lets through the odd listing well outside it (seemingly ones with
				// a price range); keep to what the user asked for
				.filter(
					(l) =>
						l.priceTotal === null ||
						((!search.priceFrom || l.priceTotal >= search.priceFrom) &&
							(!search.priceTo || l.priceTotal <= search.priceTo))
				)
		);
		const last = res.pagination?.last_page ?? page;
		// `next_page` stays set past the end, so go by last_page
		if (res.data.length === 0 || page >= last) break;
		if (page >= maxPages) {
			console.warn(`Search has more than ${maxPages} pages — the rest is cut off; narrow it down`);
			break;
		}
		await pause();
	}
	return all;
}

const OSLO_BYDELER = COUNTIES.find((c) => c.code === 'oslo')?.children ?? [];

/**
 * Run a search. hjem.no's records don't say which Oslo bydel a home is in (only finer, free-text
 * neighbourhood names), but its search filter knows — so Oslo is searched one bydel at a time
 * and each result is tagged with the bydel that found it. Everything else goes in one search.
 */
export async function fetchAllListings(
	search: ListingSearch,
	maxPages = 50
): Promise<SourceListing[]> {
	const bydeler = new Map<string, string>(); // code → name
	const rest: string[] = [];
	for (const code of search.searchLocations) {
		if (code === 'oslo' || code === 'oslo/oslo')
			for (const b of OSLO_BYDELER) bydeler.set(b.code, b.name);
		else if (code.startsWith('oslo/oslo/'))
			bydeler.set(code, OSLO_BYDELER.find((b) => b.code === code)?.name ?? code);
		else rest.push(code);
	}

	const all: SourceListing[] = [];
	for (const [code, name] of bydeler) {
		const found = await fetchPages(search, [code], maxPages);
		all.push(...found.map((l) => ({ ...l, district: name })));
		await pause();
	}
	if (rest.length > 0) all.push(...(await fetchPages(search, rest, maxPages)));

	const seen = new Set<string>();
	return all.filter((l) => (seen.has(l.finnkode) ? false : (seen.add(l.finnkode), true)));
}

// --- Details ---

const nf = (n: number) => n.toLocaleString('nb-NO');

function factsOf(p: HjemProperty): ListingFact[] {
	const facts: ListingFact[] = [];
	const add = (label: string, value: string | null) => {
		if (value) facts.push({ label, value });
	};
	const kr = (m: Money | undefined, suffix = '') => {
		const n = posInt(m?.amount);
		return n === null ? null : `${nf(n)} kr${suffix}`;
	};
	const m2 = (v: Measure | undefined) => {
		const n = posInt(v?.value);
		return n === null ? null : `${nf(n)} m²`;
	};
	const count = (v: Measure | undefined) => {
		const n = posInt(v?.value);
		return n === null ? null : String(n);
	};
	const pr = p.prices ?? {};
	const d = p.details ?? {};
	const type = p.type?.[0];

	add('Prisantydning', kr(pr.asking_price));
	add('Omkostninger', kr(pr.adding_cost));
	add('Fellesgjeld', kr(pr.joint_debt));
	add('Totalpris', kr(pr.total_price));
	add('Felleskostnader', kr(pr.shared_cost, '/mnd'));
	add('Kommunale avgifter', kr(pr.annual_municipality_fees, '/år'));
	add('Eiendomsskatt', kr(pr.annual_property_tax, '/år'));
	add('Boligtype', type ? (PROPERTY_TYPE_LABELS[type] ?? humanize(type)) : null);
	add('Eieform', p.owner_type ? (OWNER_TYPE_LABELS[p.owner_type] ?? humanize(p.owner_type)) : null);
	add('Primærrom', m2(d.primary_room));
	add('Internt bruksareal', m2(d.area_measurement?.internal));
	add('Bruksareal', m2(d.usage_area));
	add('Tomteareal', m2(d.plot_area) ?? m2(d.land_size));
	add('Soverom', count(d.bedrooms));
	add('Bad', count(d.bathrooms));
	add('Rom', count(d.total_rooms));
	add('Etasje', count(d.floor));
	add('Byggeår', p.construction_year ? String(p.construction_year) : null);
	add('Borettslag/sameie', p.land_registry?.housing_association?.name?.trim() || null);
	return facts;
}

// Area for grouping: the municipality. Not for Oslo, whose bydel comes from the search (the
// record only has free-text neighbourhood names) — null here leaves that one in place.
function districtOf(p: HjemProperty): string | null {
	const { region, suburb } = p.address ?? {};
	if (region === 'oslo') return null;
	if (region && suburb) return placeNames.get(`${region}/${suburb}`) ?? humanize(suburb);
	return null;
}

/** Fetch one listing's full record. Returns null when hjem.no has nothing for the id. */
export async function fetchDetails(id: string): Promise<SourceDetails | null> {
	const res = await getJson<HjemPage>(`${API}/api/v2/property?id=${encodeURIComponent(id)}`);
	const p = res.data?.[0];
	if (!p) return null;
	const raw = p.description?.html || p.description?.plain || '';
	const description = raw ? htmlToText(raw).slice(0, 20_000) || null : null;
	return {
		district: districtOf(p),
		bedrooms: posInt(p.details?.bedrooms?.value),
		rooms: posInt(p.details?.total_rooms?.value),
		floor: posInt(p.details?.floor?.value),
		constructionYear: posInt(p.construction_year),
		viewings: viewingsOf(p),
		images: imagesOf(p),
		facts: factsOf(p),
		description,
		facilities: [...new Set((p.facilities ?? []).map((f) => FACILITY_LABELS[f] ?? humanize(f)))]
	};
}
