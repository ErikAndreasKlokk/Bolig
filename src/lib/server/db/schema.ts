import {
	pgTable,
	text,
	integer,
	doublePrecision,
	timestamp,
	boolean,
	serial,
	index,
	jsonb,
	primaryKey
} from 'drizzle-orm/pg-core';
// Relative (not $lib) so drizzle-kit can resolve it outside Vite
import type { ListingFact, ListingImage, ListingStatus, Viewing } from '../../listing';

// One row per user; `id` is the user id from $lib/users (1 = Erik, the original single row)
export const userSettings = pgTable('user_settings', {
	id: integer('id').primaryKey().default(1),
	grossIncome: integer('gross_income').notNull().default(555000),
	netMonthly: integer('net_monthly').notNull().default(33000),
	savings: integer('savings').notNull().default(250000),
	parentalGift: integer('parental_gift').notNull().default(250000),
	combinedIncome: integer('combined_income').notNull().default(2555000),
	interestRate: doublePrecision('interest_rate').notNull().default(5.0),
	stressRate: doublePrecision('stress_rate').notNull().default(7.0),
	loanYears: integer('loan_years').notNull().default(30),
	minEquityPct: integer('min_equity_pct').notNull().default(10),

	// This user's Finn search (see $lib/search). No locations = no search.
	searchLocations: jsonb('search_locations').$type<string[]>().notNull().default([]),
	priceFrom: integer('price_from'),
	priceTo: integer('price_to'),
	propertyTypes: jsonb('property_types').$type<string[]>().notNull().default([]),
	ownershipTypes: jsonb('ownership_types').$type<string[]>().notNull().default([]),
	minSizeM2: integer('min_size_m2'),
	minBedrooms: integer('min_bedrooms'),
	// Set when the search changes: the next scrape files all new matches as already notified
	// instead of posting hundreds of "new listing" messages
	searchPending: boolean('search_pending').notNull().default(true),

	// Travel time is measured from each listing to here, arriving 08:30 on a weekday
	workAddress: text('work_address'),
	workLat: doublePrecision('work_lat'),
	workLon: doublePrecision('work_lon'),
	travelMode: text('travel_mode').$type<'transit' | 'car'>().notNull().default('transit')
});

export type UserSettings = typeof userSettings.$inferSelect;

export const listings = pgTable('listings', {
	finnkode: text('finnkode').primaryKey(),
	heading: text('heading').notNull(),
	address: text('address'),
	localArea: text('local_area'),
	priceTotal: integer('price_total'),
	priceSuggestion: integer('price_suggestion'),
	sharedCost: integer('shared_cost'),
	sizeM2: integer('size_m2'),
	bedrooms: integer('bedrooms'),
	propertyType: text('property_type'),
	ownerType: text('owner_type'),
	lat: doublePrecision('lat'),
	lon: doublePrecision('lon'),
	url: text('url').notNull(),
	imageUrl: text('image_url'),
	publishedAt: timestamp('published_at'),
	firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
	lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
	// Some user's search still returns it (see listing_matches)
	active: boolean('active').notNull().default(true),
	// Legacy single-user columns, superseded by listing_user_state (hidden/favorite/status/note)
	// and listing_matches (travelMinutes/notifiedAt). Only read once, to copy into Erik's rows
	// (userState.migrateLegacy*) — drop them once that has run in production.
	travelMinutes: integer('travel_minutes'),
	hidden: boolean('hidden').notNull().default(false),
	favorite: boolean('favorite').notNull().default(false),
	notifiedAt: timestamp('notified_at'),
	// From the ad detail page (the search card doesn't carry them) — see finn.fetchDetails
	district: text('district'),
	rooms: integer('rooms'),
	floor: integer('floor'),
	constructionYear: integer('construction_year'),
	viewings: jsonb('viewings').$type<Viewing[]>(),
	images: jsonb('images').$type<ListingImage[]>(),
	facts: jsonb('facts').$type<ListingFact[]>(),
	description: text('description'),
	facilities: jsonb('facilities').$type<string[]>(),
	detailsFetchedAt: timestamp('details_fetched_at'),
	// Legacy, see `hidden` above
	status: text('status').$type<ListingStatus>(),
	note: text('note')
});

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;

// Each user's own favorite/hidden/status/note per listing. A missing row means "untouched".
export const listingUserState = pgTable(
	'listing_user_state',
	{
		userId: integer('user_id').notNull(),
		finnkode: text('finnkode').notNull(),
		favorite: boolean('favorite').notNull().default(false),
		hidden: boolean('hidden').notNull().default(false),
		status: text('status').$type<ListingStatus>(),
		note: text('note')
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.finnkode] }),
		index('listing_user_state_finnkode_idx').on(t.finnkode)
	]
);

export type ListingUserState = typeof listingUserState.$inferSelect;

// Which listings each user's own Finn search returned. `active` = still in their results; the
// listing itself (listings.active) is active while any user's search still returns it.
export const listingMatches = pgTable(
	'listing_matches',
	{
		userId: integer('user_id').notNull(),
		finnkode: text('finnkode').notNull(),
		firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
		lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
		active: boolean('active').notNull().default(true),
		notifiedAt: timestamp('notified_at'),
		// To this user's work address (user_settings.work*), by their travel mode
		travelMinutes: integer('travel_minutes')
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.finnkode] }),
		index('listing_matches_finnkode_idx').on(t.finnkode)
	]
);

export type ListingMatch = typeof listingMatches.$inferSelect;

// One row per observed price change for a listing (also seeded on first sight),
// so we can show a price graph and detect drops over time.
export const priceHistory = pgTable(
	'price_history',
	{
		id: serial('id').primaryKey(),
		finnkode: text('finnkode').notNull(),
		priceTotal: integer('price_total'),
		priceSuggestion: integer('price_suggestion'),
		recordedAt: timestamp('recorded_at').notNull().defaultNow()
	},
	(t) => [index('price_history_finnkode_idx').on(t.finnkode)]
);

export type PriceHistory = typeof priceHistory.$inferSelect;
