// The people using the site. `id` is the key for per-user rows (user_settings.id,
// listing_user_state.user_id) — never renumber. Erik is 1 because the original single-user
// settings row had id 1.

export const USERS = [
	{ id: 1, key: 'erik', name: 'Erik' },
	{ id: 2, key: 'runar', name: 'Runar' },
	{ id: 3, key: 'eline', name: 'Eline' }
] as const;

export type User = (typeof USERS)[number];

export function userByKey(key: string | null | undefined): User | null {
	return USERS.find((u) => u.key === key) ?? null;
}
