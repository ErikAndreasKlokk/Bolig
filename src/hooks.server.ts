import { building } from '$app/environment';
import { error, redirect, type Handle } from '@sveltejs/kit';
import { runScrape } from '$lib/server/scraper';
import { SESSION_COOKIE, userFromSession } from '$lib/server/auth';
import { migrateLegacyListingState, migrateLegacyMatches } from '$lib/server/userState';
import { migrateFinnSearches } from '$lib/server/finnMigration';

// Reachable without logging in. /health is the k8s probe.
const PUBLIC_PATHS = ['/login', '/health'];

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = userFromSession(event.cookies.get(SESSION_COOKIE));
	if (!event.locals.user && !PUBLIC_PATHS.includes(event.url.pathname)) {
		if (event.url.pathname.startsWith('/api/')) error(401, 'Ikke innlogget');
		const next = event.url.pathname + event.url.search;
		redirect(303, next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`);
	}
	return resolve(event);
};

// Scrape once a day, 08:00 Oslo time — hjem.no's API is undocumented, so keep the load light.
const SCRAPE_HOURS = [8];

// The container is node:alpine without tzdata, so TZ=Europe/Oslo is ignored and
// Date.getHours() returns UTC. Derive the real Oslo hour via Intl (Node's bundled
// ICU carries its own timezone data), so the window is correct year-round (DST included).
function osloHour(d: Date): number {
	return Number(
		new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Europe/Oslo',
			hour: '2-digit',
			hourCycle: 'h23'
		}).format(d)
	);
}

function isScrapeHour(d: Date): boolean {
	return SCRAPE_HOURS.includes(osloHour(d));
}

// ms from `now` until the next top-of-hour that is a scrape hour.
// Top-of-hour is aligned in UTC, which coincides with Oslo's (whole-hour offset).
function msUntilNextRun(now: Date): number {
	const next = new Date(now);
	next.setMinutes(0, 0, 0);
	next.setHours(next.getHours() + 1); // the upcoming top of the hour
	// Advancing one hour at a time wraps across days correctly.
	while (!isScrapeHour(next)) {
		next.setHours(next.getHours() + 1);
	}
	return next.getTime() - now.getTime();
}

// The one-time data migrations must finish before the first scrape: until Erik's matches and
// search exist, a scrape would see no searches and treat every listing as new; until the searches
// are in hjem.no's codes, it would search for nothing (and then post every listing as new).
const migrated: Promise<boolean> = building
	? Promise.resolve(false)
	: migrateLegacyListingState()
			.then(migrateLegacyMatches)
			.then(migrateFinnSearches)
			.then(
				() => true,
				(e) => {
					console.error('Data migration failed — not scraping until it succeeds:', e);
					return false;
				}
			);

async function scrape(): Promise<void> {
	if (!(await migrated)) return;
	await runScrape().catch((e) => console.error('Scheduled scrape failed:', e));
}

function scheduleNext(): void {
	const delay = msUntilNextRun(new Date());
	setTimeout(() => {
		void scrape();
		scheduleNext();
	}, delay);
}

// No scrape on boot, so restarts and deploys don't add runs on top of the one a day
if (!building) scheduleNext();
