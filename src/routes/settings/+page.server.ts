import { redirect } from '@sveltejs/kit';
import { getSettings, updateSettings } from '$lib/server/settings';
import { requireUser } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const settings = await getSettings(user.id);
	return { settings, userName: user.name };
};

function num(v: FormDataEntryValue | null, fallback: number): number {
	if (v === null) return fallback;
	const n = Number(String(v).replace(/[^\d.-]/g, ''));
	return Number.isFinite(n) ? n : fallback;
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const current = await getSettings(user.id);
		await updateSettings(user.id, {
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
