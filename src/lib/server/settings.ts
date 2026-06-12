import { eq } from 'drizzle-orm';
import { db } from './db';
import { userSettings, type UserSettings } from './db/schema';

const ROW_ID = 1;

export async function getSettings(): Promise<UserSettings> {
	const rows = await db.select().from(userSettings).where(eq(userSettings.id, ROW_ID));
	if (rows.length > 0) return rows[0];
	// Seed defaults on first call
	await db.insert(userSettings).values({ id: ROW_ID }).onConflictDoNothing();
	const seeded = await db.select().from(userSettings).where(eq(userSettings.id, ROW_ID));
	return seeded[0];
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<void> {
	await getSettings(); // ensure row exists
	await db.update(userSettings).set(patch).where(eq(userSettings.id, ROW_ID));
}
