import { building } from '$app/environment';
import { runScrape } from '$lib/server/scraper';

// Scrape once at the top of each hour, daytime only — there's no point hammering
// Finn at night. The pod runs with TZ=Europe/Oslo, so these are local hours.
// Inclusive range: runs at 10:00, 11:00, … 16:00.
const FIRST_HOUR = 10;
const LAST_HOUR = 16;

function inWindow(d: Date): boolean {
	const h = d.getHours();
	return h >= FIRST_HOUR && h <= LAST_HOUR;
}

// ms from `now` until the next top-of-hour that falls inside the daytime window.
function msUntilNextRun(now: Date): number {
	const next = new Date(now);
	next.setMinutes(0, 0, 0);
	next.setHours(next.getHours() + 1); // the upcoming top of the hour
	// Skip evenings/nights — Date handles day rollover as hours wrap past 23.
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
