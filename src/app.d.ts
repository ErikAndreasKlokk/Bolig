declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Set by hooks.server.ts; every route except /login and /health requires it */
			user: import('$lib/users').User | null;
		}
		// interface PageData {}
		interface PageState {
			/** finnkode of the listing open in the drawer (shallow routing, so Back closes it) */
			listing?: string;
			/** The drawer's photo viewer is open (also shallow, so Back closes just the photo) */
			photo?: boolean;
		}
		// interface Platform {}
	}
}

export {};
