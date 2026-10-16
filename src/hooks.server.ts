import { building } from '$app/environment';
import { error, redirect, type Handle } from '@sveltejs/kit';
import { runScrape } from '$lib/server/scraper';
import { SESSION_COOKIE, userFromSession } from '$lib/server/auth';
import { migrateLegacyListingState } from '$lib/server/userState';

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

// Scrape once at the top of each hour, daytime only — there's no point hammering
// Finn at night. Inclusive range: runs at 10:00, 11:00, … 16:00 Oslo time.
const FIRST_HOUR = 10;
const LAST_HOUR = 16;

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

function inWindow(d: Date): boolean {
	const h = osloHour(d);
	return h >= FIRST_HOUR && h <= LAST_HOUR;
}

// ms from `now` until the next top-of-hour that falls inside the daytime window.
// Top-of-hour is aligned in UTC, which coincides with Oslo's (whole-hour offset).
function msUntilNextRun(now: Date): number {
	const next = new Date(now);
	next.setMinutes(0, 0, 0);
	next.setHours(next.getHours() + 1); // the upcoming top of the hour
	// Skip evenings/nights — advancing one hour at a time wraps across days correctly.
	while (!inWindow(next)) {
		next.setHours(next.getHours() + 1);
	}
	return next.getTime() - now.getTime();
}

function scheduleNext(): void {
	const delay = msUntilNextRun(new Date());
	setTimeout(() => {
		runScrape().catch((e) => console.error('Scheduled scrape failed:', e));
		scheduleNext();
	}, delay);
}

if (!building) {
	migrateLegacyListingState().catch((e) => console.error('Listing state migration failed:', e));

	// Populate right away on boot, but only if we're already within the daytime window
	// (so a deploy in the evening doesn't kick off a scrape outside the intended hours).
	if (inWindow(new Date())) {
		setTimeout(() => {
			runScrape().catch((e) => console.error('Initial scrape failed:', e));
		}, 10_000);
	}
	scheduleNext();
}
