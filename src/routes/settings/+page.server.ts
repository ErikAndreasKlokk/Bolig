import { redirect } from '@sveltejs/kit';
import { getSettings, updateSettings } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const settings = await getSettings();
	return { settings };
};

function num(v: FormDataEntryValue | null, fallback: number): number {
	if (v === null) return fallback;
	const n = Number(String(v).replace(/[^\d.-]/g, ''));
	return Number.isFinite(n) ? n : fallback;
}

export const actions: Actions = {
	save: async ({ request }) => {
		const data = await request.formData();
		const current = await getSettings();
		await updateSettings({
			grossIncome: Math.round(num(data.get('grossIncome'), current.grossIncome)),
			netMonthly: Math.round(num(data.get('netMonthly'), current.netMonthly)),
			savings: Math.round(num(data.get('savings'), current.savings)),
			parentalGift: Math.round(num(data.get('parentalGift'), current.parentalGift)),
			combinedIncome: Math.round(num(data.get('combinedIncome'), current.combinedIncome)),
			interestRate: num(data.get('interestRate'), current.interestRate),
			stressRate: num(data.get('stressRate'), current.stressRate),
			loanYears: Math.round(num(data.get('loanYears'), current.loanYears)),
			minEquityPct: Math.round(num(data.get('minEquityPct'), current.minEquityPct))
		});
		throw redirect(303, '/');
	}
};
