// Finn.no has no public JSON search endpoint — the listings page is server-rendered HTML.
// We parse the `<article class="sf-search-ad">` cards directly.
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

function decode(s: string): string {
	return s
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
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
		.split('').filter((ch) => { const cc = ch.charCodeAt(0); return cc >= 32 || cc === 9 || cc === 10 || cc === 13; }).join('');
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
	const totalMatch = html.match(/Totalpris:\s*([\d\s ]+)\s*kr/);
	const priceTotal = totalMatch ? parseInt(totalMatch[1]) : null;
	const sharedMatch = html.match(/Fellesutg\.:\s*([\d\s ]+)\s*kr/);
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
		url: `https://www.finn.no/realestate/homes/ad.html?finnkode=${finnkode}`,
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

	const cards = html.split(/<article class="[^"]*sf-search-ad[^"]*"/).slice(1);
	const listings = cards
		.map((c) => extractCard('<article class="sf-search-ad"' + c))
		.filter((l): l is FinnListing => l !== null);

	// Next-page indicator — Finn renders a "Neste side" link in the pagination footer
	const nextPage = html.includes(`&page=${page + 1}`) || html.includes(`?page=${page + 1}`);

	return { listings, nextPage };
}

export async function fetchAllListings(maxPages = 30): Promise<FinnListing[]> {
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
