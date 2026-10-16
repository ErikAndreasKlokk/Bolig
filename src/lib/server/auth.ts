import { createHmac, timingSafeEqual } from 'node:crypto';
import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { userByKey, type User } from '$lib/users';

// Deliberately simple: one shared password (APP_PASSWORD) plus picking your name. The cookie
// is "<user>.<hmac>", signed with the password itself — so it can't be forged without knowing
// the password, and changing the password logs everyone out.

export const SESSION_COOKIE = 'bolig_user';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // a year — nobody wants to log in again

function sign(userKey: string, password: string): string {
	return createHmac('sha256', password).update(`bolig:${userKey}`).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** True when the login can work at all — fail closed if the password isn't configured. */
export function authConfigured(): boolean {
	return !!env.APP_PASSWORD;
}

export function checkPassword(password: string): boolean {
	return authConfigured() && safeEqual(password, env.APP_PASSWORD!);
}

export function sessionValue(user: User): string {
	return `${user.key}.${sign(user.key, env.APP_PASSWORD!)}`;
}

/** The logged-in user. hooks.server.ts already guards every non-public route; this narrows the type. */
export function requireUser(locals: App.Locals): User {
	if (!locals.user) redirect(303, '/login');
	return locals.user;
}

export function userFromSession(value: string | undefined): User | null {
	if (!value || !authConfigured()) return null;
	const [key, mac] = value.split('.', 2);
	const user = userByKey(key);
	if (!user || !mac) return null;
	return safeEqual(mac, sign(user.key, env.APP_PASSWORD!)) ? user : null;
}
