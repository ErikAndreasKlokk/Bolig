// Finn.no has no public JSON search endpoint — the listings page is server-rendered HTML.
// We parse the `<article class="sf-search-ad">` cards directly.
import type { ListingFact, ListingImage, Viewing } from '$lib/listing';

const SEARCH_URL = 'https://www.finn.no/realestate/homes/search.html';

// Location codes (verified by selecting the area on finn.no and reading ?location=...)
const LOCATION_OSLO = '0.20061';
const LOCATION_BAERUM = '1.20003.20045';

const PRICE_FROM = 3_000_000;
const PRICE_TO = 5_000_000;

const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export interface FinnListing {
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
	publishedAt: Date | null;
}

function buildUrl(page: number): string {
	const p = new URLSearchParams([
		['location', LOCATION_OSLO],
		['location', LOCATION_BAERUM],
		['price_collective_from', String(PRICE_FROM)],
		['price_collective_to', String(PRICE_TO)],
		['sort', 'PUBLISHED_DESC']
	]);
	if (page > 1) p.set('page', String(page));
	return `${SEARCH_URL}?${p}`;
}

const parseInt16 = (s: string) => Number.parseInt(s, 16);

function decode(s: string): string {
	return (
		s
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
			.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt16(n)))
			.replace(/&aring;/g, 'å')
			.replace(/&Aring;/g, 'Å')
			.replace(/&oslash;/g, 'ø')
			.replace(/&Oslash;/g, 'Ø')
			.replace(/&aelig;/g, 'æ')
			.replace(/&AElig;/g, 'Æ')
			.replace(/&nbsp;/g, ' ')
			// Finn uses U+2219 BULLET OPERATOR as separator
			.replace(/∙/g, '·')
			// Strip C0 control characters incl. NUL — Postgres rejects them in text columns
			.split('')
			.filter((ch) => {
				const cc = ch.charCodeAt(0);
				return cc >= 32 || cc === 9 || cc === 10 || cc === 13;
			})
			.join('')
	);
}

function parseInt(s: string | undefined): number | null {
	if (!s) return null;
	const cleaned = s.replace(/[^\d]/g, '');
	if (!cleaned) return null;
	return Number(cleaned);
}

function extractCard(html: string): FinnListing | null {
	const idMatch = html.match(/aria-owns="search-ad-(\d+)"/);
	if (!idMatch) return null;
	const finnkode = idMatch[1];

	// Heading: <h2 ... sf-realestate-heading...><a ...>TEXT</a></h2>
	const headingMatch = html.match(
		/<h2[^>]*sf-realestate-heading[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a><\/h2>/
	);
	const heading = headingMatch
		? decode(headingMatch[1].replace(/<[^>]*>/g, '').trim())
		: '(uten tittel)';

	// Address: <div ... sf-realestate-location><span...>ADDRESS</span></div>
	const addressMatch = html.match(
		/sf-realestate-location[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/
	);
	const address = addressMatch ? decode(addressMatch[1].replace(/<[^>]*>/g, '').trim()) : null;

	// Local area: substring after the last comma in the address (e.g. "..., Oslo" → "Oslo")
	const localArea = address?.split(',').pop()?.trim() ?? null;

	// Size + Prisant row: <div ...><span>33 m²</span><span>4 500 000 kr</span></div>
	const sizeRowMatch = html.match(
		/<div[^>]*font-bold[^>]*>\s*<span[^>]*>([^<]*)<\/span>\s*<span[^>]*>([^<]*)<\/span>\s*<\/div>/
	);
	const sizeM2 = sizeRowMatch ? parseInt(sizeRowMatch[1]) : null;
	const priceSuggestion = sizeRowMatch ? parseInt(sizeRowMatch[2]) : null;

	// Totalpris + Fellesutg + Selveier ∙ Leilighet
	const totalMatch = html.match(/Totalpris:\s*([\d\s\u00a0]+)\s*kr/);
	const priceTotal = totalMatch ? parseInt(totalMatch[1]) : null;
	const sharedMatch = html.match(/Fellesutg\.:\s*([\d\s\u00a0]+)\s*kr/);
	const sharedCost = sharedMatch ? parseInt(sharedMatch[1]) : null;

	// Owner + property type — final <span> in the description line
	// e.g. "Selveier · Leilighet" or "Andel · Tomannsbolig"
	const typeMatch = html.match(
		/<span>([^<]*?(?:Selveier|Andel|Aksje|Obligasjon|Eiet|Festet)[^<]*)<\/span>/
	);
	let ownerType: string | null = null;
	let propertyType: string | null = null;
	if (typeMatch) {
		const parts = decode(typeMatch[1])
			.split(/\s*[·∙]\s*/)
			.map((s) => s.trim())
			.filter(Boolean);
		ownerType = parts[0] ?? null;
		propertyType = parts[1] ?? null;
	}

	// Ad link — new-build projects live under /realestate/project(single)/, not /homes/
	const hrefMatch = html.match(
		/href="((?:https:\/\/www\.finn\.no)?\/realestate\/[a-z]+\/ad\.html\?finnkode=\d+)"/
	);
	const url = hrefMatch
		? new URL(decode(hrefMatch[1]), 'https://www.finn.no').toString()
		: `https://www.finn.no/realestate/homes/ad.html?finnkode=${finnkode}`;

	// First image — use the 480w variant (good enough for cards)
	const imgMatch = html.match(/src="(https:\/\/images\.finncdn\.no\/[^"]+)"/);
	const imageUrl = imgMatch ? imgMatch[1] : null;

	return {
		finnkode,
		heading,
		address,
		localArea,
		priceTotal,
		priceSuggestion,
		sharedCost,
		sizeM2,
		bedrooms: null, // Not exposed on the search card — would require fetching detail page
		propertyType,
		ownerType,
		lat: null, // Filled by geocoder later
		lon: null,
		url,
		imageUrl,
		publishedAt: null
	};
}

async function fetchPage(page: number): Promise<{ listings: FinnListing[]; nextPage: boolean }> {
	const res = await fetch(buildUrl(page), {
		headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }
	});
	if (!res.ok) throw new Error(`Finn search failed: ${res.status} ${res.statusText}`);
	const html = await res.text();

	if (page === 1) learnOsloDistricts(html);

	const cards = html.split(/<article class="[^"]*sf-search-ad[^"]*"/).slice(1);
	const listings = cards
		.map((c) => extractCard('<article class="sf-search-ad"' + c))
		.filter((l): l is FinnListing => l !== null);

	// Next-page indicator. Finn's pagination link is HTML-entity-encoded (`&amp;page=N`) and
	// tagged rel="next", so the old `&page=N`/`?page=N` checks never matched — we only ever
	// scraped page 1 and marked every older (still-listed) home inactive. Match the link by its
	// trailing `page=N"` regardless of how the ampersand is encoded, with rel="next" as backup.
	const nextPage = html.includes(`page=${page + 1}"`) || /rel="next"/.test(html);

	return { listings, nextPage };
}

export interface FinnDetails {
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

const IMAGE_BASE = 'https://images.finncdn.no/dynamic/1280w/';

// The server-rendered carousel <img> tags all carry the *first* photo's src (the rest is swapped
// in client-side), but their `title` captions are correct per index. Take the photo list from
// the targeting array (homes) or, for project pages without one, from the `item/<id>/<uuid>`
// paths in the embedded data, and pair them with the captions by index.
function parseImages(html: string, kv: string | undefined): ListingImage[] {
	let paths: string[] = [];
	if (kv) {
		try {
			paths = JSON.parse(`[${kv}]`) as string[];
		} catch {
			paths = [];
		}
	}
	if (paths.length === 0) {
		paths = [
			...new Set(
				[...html.matchAll(/images\.finncdn\.no\/dynamic\/[^/]+\/(item\/\d+\/[0-9a-f-]{36})/g)].map(
					(m) => m[1]
				)
			)
		];
	}
	const captions = new Map<number, string>();
	for (const m of html.matchAll(/<img[^>]*id="image-(\d+)"[^>]*>/g)) {
		const title = m[0].match(/title="([^"]*)"/)?.[1];
		if (title) captions.set(Number(m[1]), decode(title));
	}
	return paths
		.slice(0, 80)
		.map((p, i) => ({ url: IMAGE_BASE + p, caption: captions.get(i) ?? null }));
}

// Key facts + price details: <div data-testid="info-…|pricing-…"><dt>Label</dt><dd>Value</dd></div>
function parseFacts(html: string): ListingFact[] {
	const facts: ListingFact[] = [];
	const re =
		/data-testid="(?:info|pricing)-[a-z-]+"[^>]*>\s*<dt[^>]*>([^<]*)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g;
	for (const m of html.matchAll(re)) {
		const label = decode(m[1]).trim();
		// Energy label is an SVG badge — its text lives in aria-label ("Energimerke E")
		const value =
			decode(m[2].replace(/<[^>]*>/g, ' '))
				.replace(/\s+/g, ' ')
				.trim() ||
			decode(m[2].match(/aria-label="([^"]*)"/)?.[1] ?? '').replace(/^Energimerke\s*/, '');
		if (label && value && !facts.some((f) => f.label === label)) facts.push({ label, value });
	}
	return facts;
}

// "Om boligen" body, flattened to plain text with paragraph breaks (rendered as text, not HTML)
function parseDescription(html: string): string | null {
	const start = html.indexOf('data-testid="about-property"');
	if (start < 0) return null;
	const m = html.slice(start, start + 60_000).match(/description-area[^>]*>([\s\S]*?)<\/div>/);
	if (!m) return null;
	const text = decode(
		m[1]
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<\/(p|h\d|li)>/gi, '\n')
			.replace(/<li[^>]*>/gi, '• ')
			.replace(/<[^>]*>/g, '')
	)
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	return text ? text.slice(0, 20_000) : null;
}

function parseFacilities(kv: string | undefined): string[] {
	if (!kv) return [];
	try {
		return (JSON.parse(`[${kv}]`) as string[]).map(decode);
	} catch {
		return [];
	}
}

// Raw JSON array body of a multi-value targeting key, e.g. `"a.jpg","b.jpg"`
function targetingArray(html: string, key: string): string | undefined {
	return html.match(new RegExp(`\\{"key":"${key}","value":\\[([^\\]]*)\\]`))?.[1];
}

// The detail page embeds an ad-targeting array of `{"key":"bedrooms","value":["3"]}` entries —
// far more stable than the rendered markup, so read the scalar fields from there.
function targetingValues(html: string): Map<string, string> {
	const out = new Map<string, string>();
	for (const m of html.matchAll(/\{"key":"([a-z_]+)","value":\[("[^"]*")/g)) {
		if (!out.has(m[1])) out.set(m[1], decode(JSON.parse(m[2]) as string));
	}
	return out;
}

function hhmmToMinutes(s: string): number {
	const [h, m] = s.split(':').map(Number);
	return h * 60 + m;
}

// Each viewing block carries an "add to calendar" link with the exact UTC start
// (`iCalendarFrom=20261005T150000Z`) and the local "17:00 – 18:00" range; the end is derived
// from the local duration so we don't need to know the Oslo offset.
function parseViewings(html: string): Viewing[] {
	const viewings: Viewing[] = [];
	for (const block of html.split('data-testid="viewings-').slice(1)) {
		const chunk = block.slice(0, 2000);
		const hrefMatch = chunk.match(
			/href="(\/realestate\/calendar\.ics\?[^"]*iCalendarFrom=(\d{8}T\d{6}Z)[^"]*)"/
		);
		if (!hrefMatch) continue; // e.g. "etter avtale" — no fixed time
		const c = hrefMatch[2];
		const start = new Date(
			`${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}T${c.slice(9, 11)}:${c.slice(11, 13)}:${c.slice(13, 15)}Z`
		);
		if (isNaN(start.getTime())) continue;

		let end: string | null = null;
		const text = chunk.replace(/<!--.*?-->/g, '').replace(/<[^>]*>/g, ' ');
		const range = text.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
		if (range) {
			let mins = hhmmToMinutes(range[2]) - hhmmToMinutes(range[1]);
			if (mins <= 0) mins += 24 * 60;
			end = new Date(start.getTime() + mins * 60_000).toISOString();
		}
		// The block is rendered twice (mobile + desktop layout)
		if (viewings.some((v) => v.start === start.toISOString())) continue;
		viewings.push({
			start: start.toISOString(),
			end,
			calendarUrl: `https://www.finn.no${decode(hrefMatch[1])}`
		});
	}
	return viewings;
}

// Oslo bydel names keyed by Finn's sub-area code (e.g. "20511" → "Grünerløkka - Sofienberg").
// The search page's location filter embeds them as `"Name","1.20061.20511"` (JSON-escaped).
const osloDistricts = new Map<string, string>();

function learnOsloDistricts(html: string): void {
	for (const m of html.matchAll(/\\?"([^"\\]{2,60})\\?",\\?"1\.20061\.(\d+)\\?"/g)) {
		osloDistricts.set(m[2], decode(m[1]));
	}
	if (osloDistricts.size === 0) console.warn('Found no Oslo districts on the search page');
}

// The ad's own `local_area_name` is free text from the broker ("Bo midt på Majorstuen", often
// missing), useless for grouping. Use Finn's bydel for Oslo; Bærum has no sub-areas on Finn.
function districtOf(kv: Map<string, string>): string | null {
	if (kv.get('municipality') === '20045') return 'Bærum';
	const sub = kv.get('sub_area');
	return (sub && osloDistricts.get(sub)) || null;
}

/** Fetch an ad's detail page. Returns null when the ad is gone (404/410). */
export async function fetchDetails(url: string): Promise<FinnDetails | null> {
	const res = await fetch(url, {
		headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }
	});
	if (res.status === 404 || res.status === 410) return null;
	if (!res.ok) throw new Error(`Finn ad ${url} failed: ${res.status} ${res.statusText}`);
	const html = await res.text();

	const kv = targetingValues(html);
	// Project (new-build) pages lack the targeting array but render the same key-facts list:
	// <div data-testid="info-bedrooms"><dt>Soverom</dt><dd …>2</dd></div>
	const num = (key: string, testId: string) =>
		parseInt(kv.get(key)) ??
		parseInt(
			html.match(
				new RegExp(`data-testid="info-${testId}"[^>]*>\\s*<dt[^>]*>[^<]*</dt>\\s*<dd[^>]*>([^<]*)<`)
			)?.[1]
		);
	return {
		district: districtOf(kv),
		bedrooms: num('bedrooms', 'bedrooms'),
		rooms: num('rooms', 'rooms'),
		floor: num('floor', 'floor'),
		constructionYear: num('construction_year', 'construction-year'),
		viewings: parseViewings(html),
		images: parseImages(html, targetingArray(html, 'images')),
		facts: parseFacts(html),
		description: parseDescription(html),
		facilities: parseFacilities(targetingArray(html, 'facilities'))
	};
}

export async function fetchAllListings(maxPages = 50): Promise<FinnListing[]> {
	const all: FinnListing[] = [];
	let page = 1;

	for (;;) {
		const { listings, nextPage } = await fetchPage(page);
		all.push(...listings);
		if (!nextPage || page >= maxPages || listings.length === 0) break;
		page++;
		await new Promise((r) => setTimeout(r, 1000));
	}

	const seen = new Set<string>();
	return all.filter((l) => (seen.has(l.finnkode) ? false : (seen.add(l.finnkode), true)));
}
