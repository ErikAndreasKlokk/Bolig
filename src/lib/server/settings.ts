import { eq } from 'drizzle-orm';
import { db } from './db';
import { userSettings, type UserSettings } from './db/schema';

// One row per user, keyed by the user id
export async function getSettings(userId: number): Promise<UserSettings> {
	const rows = await db.select().from(userSettings).where(eq(userSettings.id, userId));
	if (rows.length > 0) return rows[0];
	// Seed defaults on first call
	await db.insert(userSettings).values({ id: userId }).onConflictDoNothing();
	const seeded = await db.select().from(userSettings).where(eq(userSettings.id, userId));
	return seeded[0];
}

export async function updateSettings(userId: number, patch: Partial<UserSettings>): Promise<void> {
	await getSettings(userId); // ensure row exists
	await db.update(userSettings).set(patch).where(eq(userSettings.id, userId));
}
