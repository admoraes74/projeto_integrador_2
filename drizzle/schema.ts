import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/** Core user table backing Manus OAuth. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const providerProfiles = mysqlTable("provider_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  isComplete: boolean("isComplete").notNull().default(true),
  guestTokenHash: varchar("guestTokenHash", { length: 64 }).unique(),
  companyName: varchar("companyName", { length: 120 }).notNull(),
  professionalName: varchar("professionalName", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 24 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 24 }).notNull(),
  specialties: text("specialties").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const portfolioItems = mysqlTable("portfolio_items", {
  id: int("id").autoincrement().primaryKey(),
  profileId: int("profileId").notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  description: text("description").notNull(),
  specialty: varchar("specialty", { length: 80 }).notNull(),
  imageKey: varchar("imageKey", { length: 512 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const providerRatings = mysqlTable("provider_ratings", {
  id: int("id").autoincrement().primaryKey(),
  profileId: int("profileId").notNull().references(() => providerProfiles.id, { onDelete: "cascade" }),
  voterHash: varchar("voterHash", { length: 64 }).notNull(),
  stars: int("stars").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  oneVotePerBrowser: uniqueIndex("provider_ratings_profile_voter_uq").on(table.profileId, table.voterHash),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ProviderProfile = typeof providerProfiles.$inferSelect;
export type PortfolioItem = typeof portfolioItems.$inferSelect;
export type ProviderRating = typeof providerRatings.$inferSelect;
