import { json } from '@sveltejs/kit';
import { runScrape } from '$lib/server/scraper';

export async function POST() {
	const result = await runScrape();
	return json(result);
}
