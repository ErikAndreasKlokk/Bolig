import { eq, asc, and, sql, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { listings } from '$lib/server/db/schema';
import { getSettings } from '$lib/server/settings';
import { computeAffordability, type Affordability } from '$lib/affordability';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const showHidden = url.searchParams.get('hidden') === '1';
	const showInactive = url.searchParams.get('inactive') === '1';
	const onlyAffordable = url.searchParams.get('affordable') === '1';

	const conditions: SQL[] = [];
	if (!showHidden) conditions.push(eq(listings.hidden, false));
	if (!showInactive) conditions.push(eq(listings.active, true));

	const rows = await db
		.select()
		.from(listings)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(
			sql`${listings.favorite} desc`,
			sql`${listings.travelMinutes} asc nulls last`,
			asc(listings.priceTotal)
		);

	const settings = await getSettings();

	const withAffordability = rows.map((l) => ({
		...l,
		afford: computeAffordability(l, settings) as Affordability | null
	}));

	const filtered = onlyAffordable
		? withAffordability.filter((l) => l.afford && l.afford.level !== 'red')
		: withAffordability;

	return { listings: filtered, settings, showHidden, showInactive, onlyAffordable };
};

export const actions: Actions = {
	hide: async ({ request }) => {
		const data = await request.formData();
		const finnkode = String(data.get('finnkode'));
		const hidden = data.get('hidden') === 'true';
		await db.update(listings).set({ hidden }).where(eq(listings.finnkode, finnkode));
	},
	favorite: async ({ request }) => {
		const data = await request.formData();
		const finnkode = String(data.get('finnkode'));
		const favorite = data.get('favorite') === 'true';
		await db.update(listings).set({ favorite }).where(eq(listings.finnkode, finnkode));
	}
};
