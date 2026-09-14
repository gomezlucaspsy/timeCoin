import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

// Fase 1 (wallet, ledger, mint events) todavía no se implementó.

export const listingStatusEnum = pgEnum("listing_status", [
  "active",
  "paused",
  "sold",
]);

export const paymentModeEnum = pgEnum("payment_mode", [
  "cash",
  "timecoin",
  "both",
]);

export const listings = pgTable("listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  sellerId: text("seller_id").notNull(), // Clerk user id
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  paymentMode: paymentModeEnum("payment_mode").notNull().default("cash"),
  priceArs: integer("price_ars"), // pesos argentinos, null si no acepta cash
  priceHours: numeric("price_hours", { precision: 18, scale: 8 }), // horas TimeCoin, null si no acepta timecoin (8 decimales, igual granularidad que un satoshi)
  images: text("images").array().notNull().default([]),
  status: listingStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
