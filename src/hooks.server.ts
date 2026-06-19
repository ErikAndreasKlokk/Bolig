import { building } from '$app/environment';
import { runScrape } from '$lib/server/scraper';

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
	// Populate right away on boot, but only if we're already within the daytime window
	// (so a deploy in the evening doesn't kick off a scrape outside the intended hours).
	if (inWindow(new Date())) {
		setTimeout(() => {
			runScrape().catch((e) => console.error('Initial scrape failed:', e));
		}, 10_000);
	}
	scheduleNext();
}
