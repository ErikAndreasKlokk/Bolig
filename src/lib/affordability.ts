import type { Listing, UserSettings } from './server/db/schema';

export interface Affordability {
	price: number;
	loan: number;
	monthly: number;
	monthlyStress: number;
	totalMonthly: number;
	totalMonthlyStress: number;
	pctOfNet: number;
	pctOfNetStress: number;
	equityOK: boolean;
	gjeldsgradOK: boolean;
	stressOK: boolean;
	equityGap: number;
	level: 'green' | 'amber' | 'red';
	reasons: string[];
}

function annuity(principal: number, annualRatePct: number, years: number): number {
	const r = annualRatePct / 100 / 12;
	const n = years * 12;
	if (r === 0) return principal / n;
	return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function computeAffordability(
	listing: Pick<Listing, 'priceTotal' | 'priceSuggestion' | 'sharedCost'>,
	settings: UserSettings
): Affordability | null {
	const price = listing.priceTotal ?? listing.priceSuggestion;
	if (!price) return null;

	const downpayment = settings.savings + settings.parentalGift;
	const requiredEquity = Math.round((price * settings.minEquityPct) / 100);
	const equityGap = Math.max(0, requiredEquity - downpayment);
	const loan = Math.max(0, price - downpayment);

	const monthly = annuity(loan, settings.interestRate, settings.loanYears);
	const monthlyStress = annuity(loan, settings.stressRate, settings.loanYears);
	const sharedCost = listing.sharedCost ?? 0;
	const totalMonthly = monthly + sharedCost;
	const totalMonthlyStress = monthlyStress + sharedCost;
	const pctOfNet = totalMonthly / settings.netMonthly;
	const pctOfNetStress = totalMonthlyStress / settings.netMonthly;

	const equityOK = downpayment >= requiredEquity;
	const gjeldsgradOK = loan <= settings.combinedIncome * 5;
	// Bank stress test: at 7% rate, total housing cost must leave room for living
	const stressOK = pctOfNetStress <= 0.8;

	const reasons: string[] = [];
	if (!equityOK) reasons.push(`Mangler ${equityGap.toLocaleString('no-NO')} kr i egenkapital`);
	if (!gjeldsgradOK) reasons.push('Bryter 5x-gjeldsgradregelen');
	if (!stressOK)
		reasons.push(`Strakk for tight ved 7% stress (${Math.round(pctOfNetStress * 100)}% av netto)`);

	let level: 'green' | 'amber' | 'red';
	if (!equityOK || !gjeldsgradOK || !stressOK) level = 'red';
	else if (pctOfNet > 0.7) level = 'amber';
	else level = 'green';

	if (level === 'green' && pctOfNet > 0.55) {
		reasons.push(`Trang månedlig (${Math.round(pctOfNet * 100)}% av netto)`);
	}

	return {
		price,
		loan,
		monthly,
		monthlyStress,
		totalMonthly,
		totalMonthlyStress,
		pctOfNet,
		pctOfNetStress,
		equityOK,
		gjeldsgradOK,
		stressOK,
		equityGap,
		level,
		reasons
	};
}
