declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** finnkode of the listing open in the drawer (shallow routing, so Back closes it) */
			listing?: string;
		}
		// interface Platform {}
	}
}

export {};
