import { env } from '$env/dynamic/private';
import type { Listing } from './db/schema';

function formatPrice(n: number | null): string {
	return n === null ? '?' : `${n.toLocaleString('no-NO')} kr`;
}

export async function notifyNewListings(listings: Listing[]): Promise<void> {
	const webhookUrl = env.DISCORD_WEBHOOK_URL;
	if (!webhookUrl) {
		console.warn('DISCORD_WEBHOOK_URL not set — skipping Discord notification');
		return;
	}

	// Discord allows max 10 embeds per message
	for (let i = 0; i < listings.length; i += 10) {
		const batch = listings.slice(i, i + 10);
		const embeds = batch.map((l) => ({
			title: l.heading.slice(0, 256),
			url: l.url,
			color: 0x0063fb,
			thumbnail: l.imageUrl ? { url: l.imageUrl } : undefined,
			fields: [
				{ name: 'Totalpris', value: formatPrice(l.priceTotal), inline: true },
				{ name: 'Størrelse', value: l.sizeM2 ? `${l.sizeM2} m²` : '?', inline: true },
				{
					name: 'Reisetid til jobb',
					value: l.travelMinutes !== null ? `${l.travelMinutes} min` : '?',
					inline: true
				},
				{ name: 'Område', value: l.localArea ?? l.address ?? '?', inline: true },
				{ name: 'Type', value: `${l.propertyType ?? '?'} (${l.ownerType ?? '?'})`, inline: true }
			]
		}));

		const res = await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				content: `🏠 ${batch.length} ny${batch.length > 1 ? 'e' : ''} bolig${batch.length > 1 ? 'er' : ''} på Finn!`,
				embeds
			})
		});
		if (!res.ok) {
			console.error(`Discord webhook failed: ${res.status} ${await res.text()}`);
		}
		if (i + 10 < listings.length) await new Promise((r) => setTimeout(r, 1000));
	}
}
