// Entur APIs — free, only need an ET-Client-Name header.
//   journey-planner — public transport routing (GraphQL)
//   geocoder        — address → coordinates (Pelias)
const JOURNEY_URL = 'https://api.entur.io/journey-planner/v3/graphql';
const GEOCODER_URL = 'https://api.entur.io/geocoder/v1/search';
const CLIENT_NAME = 'erikak-bolig';

// Verkstedveien 1, 0277 Oslo (Skøyen)
const WORK = { latitude: 59.92152, longitude: 10.69847 };

const TRIP_QUERY = `
query Trip($fromLat: Float!, $fromLon: Float!, $toLat: Float!, $toLon: Float!, $dateTime: DateTime!) {
	trip(
		from: { coordinates: { latitude: $fromLat, longitude: $fromLon } }
		to: { coordinates: { latitude: $toLat, longitude: $toLon } }
		dateTime: $dateTime
		arriveBy: true
		numTripPatterns: 3
	) {
		tripPatterns { duration }
	}
}`;

// Next weekday at 08:30 — a realistic "arrive at work" target.
// Container runs Europe/Oslo via TZ env; we serialise local time explicitly with +01:00 offset.
// (Entur accepts both +01 and +02; results are approximate anyway.)
function nextWeekdayMorning(): string {
	const d = new Date();
	d.setDate(d.getDate() + 1);
	while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T08:30:00+01:00`;
}

export async function transitMinutesToWork(lat: number, lon: number): Promise<number | null> {
	const res = await fetch(JOURNEY_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'ET-Client-Name': CLIENT_NAME },
		body: JSON.stringify({
			query: TRIP_QUERY,
			variables: {
				fromLat: lat,
				fromLon: lon,
				toLat: WORK.latitude,
				toLon: WORK.longitude,
				dateTime: nextWeekdayMorning()
			}
		})
	});
	if (!res.ok) {
		console.error(`Entur journey failed: ${res.status} ${res.statusText}`);
		return null;
	}

	const data = await res.json();
	const patterns: { duration: number }[] = data?.data?.trip?.tripPatterns ?? [];
	if (patterns.length === 0) return null;

	const fastest = Math.min(...patterns.map((p) => p.duration));
	return Math.round(fastest / 60);
}

export async function geocodeAddress(
	address: string
): Promise<{ lat: number; lon: number } | null> {
	const url = `${GEOCODER_URL}?${new URLSearchParams({
		text: address,
		'boundary.country': 'NO',
		size: '1'
	})}`;
	const res = await fetch(url, { headers: { 'ET-Client-Name': CLIENT_NAME } });
	if (!res.ok) {
		console.error(`Entur geocoder failed for "${address}": ${res.status}`);
		return null;
	}
	const data = await res.json();
	const feat = data?.features?.[0];
	if (!feat?.geometry?.coordinates) return null;
	const [lon, lat] = feat.geometry.coordinates;
	return { lat, lon };
}
