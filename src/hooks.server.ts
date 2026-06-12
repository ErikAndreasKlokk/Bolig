import { building } from '$app/environment';
import { runScrape } from '$lib/server/scraper';

const SCRAPE_INTERVAL_MS = 30 * 60 * 1000;

if (!building) {
	setTimeout(() => {
		runScrape().catch((e) => console.error('Initial scrape failed:', e));
	}, 10_000);

	setInterval(() => {
		runScrape().catch((e) => console.error('Scheduled scrape failed:', e));
	}, SCRAPE_INTERVAL_MS);
}
