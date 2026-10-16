import { fail, redirect } from '@sveltejs/kit';
import {
	authConfigured,
	checkPassword,
	SESSION_COOKIE,
	SESSION_MAX_AGE,
	sessionValue
} from '$lib/server/auth';
import { userByKey, USERS } from '$lib/users';
import type { Actions, PageServerLoad } from './$types';

// Only same-site paths, so ?next= can't bounce people to another site
function safeNext(next: string | null): string {
	return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
	return {
		users: USERS.map(({ key, name }) => ({ key, name })),
		configured: authConfigured()
	};
};

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const user = userByKey(String(data.get('user') ?? ''));
		const password = String(data.get('password') ?? '');
		if (!user) return fail(400, { user: null, error: 'Velg hvem du er' });
		if (!checkPassword(password)) return fail(400, { user: user.key, error: 'Feil passord' });
		cookies.set(SESSION_COOKIE, sessionValue(user), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: SESSION_MAX_AGE
		});
		// `action="?/login"` replaces the query string, so the page passes ?next= along as a field
		redirect(303, safeNext(data.get('next') as string | null));
	},
	logout: async ({ cookies }) => {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		redirect(303, '/login');
	}
};
