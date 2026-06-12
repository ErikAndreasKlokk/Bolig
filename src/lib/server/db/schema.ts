import {
	pgTable,
	text,
	integer,
	doublePrecision,
	timestamp,
	boolean
} from 'drizzle-orm/pg-core';

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
	travelMinutes: integer('travel_minutes'),
	firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
	lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
	active: boolean('active').notNull().default(true),
	hidden: boolean('hidden').notNull().default(false),
	favorite: boolean('favorite').notNull().default(false),
	notifiedAt: timestamp('notified_at')
});

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
