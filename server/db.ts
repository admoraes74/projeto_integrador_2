import { and, avg, count, desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHash } from "node:crypto";
import { InsertUser, portfolioItems, providerProfiles, providerRatings, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

/** Lazily connect so type checks and local tooling can run without a DB. */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listProviderProfiles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(providerProfiles).where(eq(providerProfiles.isComplete, true)).orderBy(desc(providerProfiles.updatedAt));
}

export async function getProviderProfileById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(providerProfiles).where(eq(providerProfiles.id, id)).limit(1);
  return rows[0];
}

function hashRatingVoterId(voterId: string) {
  return createHash("sha256").update(voterId).digest("hex");
}

export async function getProviderRatingSummary(profileId: number, voterId?: string) {
  const db = await getDb();
  if (!db) return { average: 0, count: 0, myRating: null as number | null };
  const [summary] = await db.select({ average: avg(providerRatings.stars), count: count() })
    .from(providerRatings).where(eq(providerRatings.profileId, profileId));
  const voterHash = voterId ? hashRatingVoterId(voterId) : null;
  const ownRows = voterHash ? await db.select({ stars: providerRatings.stars }).from(providerRatings).where(and(
    eq(providerRatings.profileId, profileId),
    eq(providerRatings.voterHash, voterHash),
  )).limit(1) : [];
  return {
    average: summary?.average ? Math.round(Number(summary.average) * 10) / 10 : 0,
    count: Number(summary?.count ?? 0),
    myRating: ownRows[0]?.stars ?? null,
  };
}

export async function saveProviderRating(profileId: number, voterId: string, stars: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const profile = await getProviderProfileById(profileId);
  if (!profile?.isComplete) return undefined;
  await db.insert(providerRatings).values({
    profileId,
    voterHash: hashRatingVoterId(voterId),
    stars,
  }).onDuplicateKeyUpdate({ set: { stars } });
  return getProviderRatingSummary(profileId, voterId);
}

export async function getProviderProfilesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(providerProfiles).where(eq(providerProfiles.userId, userId)).orderBy(desc(providerProfiles.updatedAt));
}

export async function getProviderProfileByUserId(userId: number) {
  const profiles = await getProviderProfilesByUserId(userId);
  return profiles[0];
}

export async function getProviderProfileByIdAndUserId(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(providerProfiles).where(and(eq(providerProfiles.id, id), eq(providerProfiles.userId, userId))).limit(1);
  return rows[0];
}

export type ProviderProfileInput = {
  companyName: string;
  professionalName: string;
  phone: string;
  whatsapp: string;
  specialties: string[];
  description: string;
};

/** A missing profileId always creates a new independent directory record. */
export async function saveProviderProfile(userId: number, data: ProviderProfileInput, profileId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values = {
    companyName: data.companyName,
    professionalName: data.professionalName,
    phone: data.phone,
    whatsapp: data.whatsapp,
    specialties: JSON.stringify(data.specialties),
    description: data.description,
  };

  if (profileId !== undefined) {
    const existing = await getProviderProfileByIdAndUserId(profileId, userId);
    if (!existing) throw new Error("Provider profile not found for this account");
    await db.update(providerProfiles).set(values).where(and(eq(providerProfiles.id, profileId), eq(providerProfiles.userId, userId)));
    const updated = await getProviderProfileById(profileId);
    if (!updated) throw new Error("Could not read updated provider profile");
    return updated;
  }

  const [created] = await db.insert(providerProfiles).values({ userId, isComplete: false, ...values }).$returningId();
  if (!created?.id) throw new Error("Could not create provider profile");
  const profile = await getProviderProfileById(created.id);
  if (!profile) throw new Error("Could not read created provider profile");
  return profile;
}

export async function completeProviderProfile(profileId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const profile = await getProviderProfileByIdAndUserId(profileId, userId);
  if (!profile) throw new Error("Provider profile not found for this account");
  const items = await listPortfolioItems(profileId);
  if (items.length === 0) throw new Error("At least one service photo is required before publishing");
  await db.update(providerProfiles).set({ isComplete: true }).where(and(eq(providerProfiles.id, profileId), eq(providerProfiles.userId, userId)));
  return getProviderProfileById(profileId);
}

function hashGuestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getGuestProviderProfileByToken(profileId: number, token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(providerProfiles).where(and(
    eq(providerProfiles.id, profileId),
    eq(providerProfiles.guestTokenHash, hashGuestToken(token)),
  )).limit(1);
  return rows[0];
}

export async function createGuestProviderProfile(data: ProviderProfileInput, token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const guestTokenHash = hashGuestToken(token);
  const existing = await db.select().from(providerProfiles).where(eq(providerProfiles.guestTokenHash, guestTokenHash)).limit(1);
  if (existing[0]) {
    if (existing[0].userId !== null || existing[0].isComplete) throw new Error("This guest draft is already published");
    await db.update(providerProfiles).set({
      companyName: data.companyName,
      professionalName: data.professionalName,
      phone: data.phone,
      whatsapp: data.whatsapp,
      specialties: JSON.stringify(data.specialties),
      description: data.description,
    }).where(eq(providerProfiles.id, existing[0].id));
    const refreshed = await getProviderProfileById(existing[0].id);
    if (!refreshed) throw new Error("Could not refresh guest provider profile");
    return refreshed;
  }
  const [created] = await db.insert(providerProfiles).values({
    userId: null,
    isComplete: false,
    guestTokenHash,
    companyName: data.companyName,
    professionalName: data.professionalName,
    phone: data.phone,
    whatsapp: data.whatsapp,
    specialties: JSON.stringify(data.specialties),
    description: data.description,
  }).$returningId();
  if (!created?.id) throw new Error("Could not create guest provider profile");
  const profile = await getProviderProfileById(created.id);
  if (!profile) throw new Error("Could not read guest provider profile");
  return profile;
}

export async function updateGuestProviderProfile(profileId: number, data: ProviderProfileInput, token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const tokenHash = hashGuestToken(token);
  const existing = await getGuestProviderProfileByToken(profileId, token);
  if (!existing || existing.userId !== null) return undefined;
  await db.update(providerProfiles).set({
    companyName: data.companyName,
    professionalName: data.professionalName,
    phone: data.phone,
    whatsapp: data.whatsapp,
    specialties: JSON.stringify(data.specialties),
    description: data.description,
  }).where(and(
    eq(providerProfiles.id, profileId),
    eq(providerProfiles.guestTokenHash, tokenHash),
    isNull(providerProfiles.userId),
  ));
  return getProviderProfileById(profileId);
}

export async function completeGuestProviderProfile(profileId: number, token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const profile = await getGuestProviderProfileByToken(profileId, token);
  if (!profile) throw new Error("Guest provider profile not found");
  if (profile.isComplete) return profile;
  const items = await listPortfolioItems(profileId);
  if (items.length === 0) throw new Error("At least one service photo is required before publishing");
  await db.update(providerProfiles).set({ isComplete: true }).where(and(
    eq(providerProfiles.id, profileId),
    eq(providerProfiles.guestTokenHash, hashGuestToken(token)),
  ));
  return getProviderProfileById(profileId);
}

export async function claimGuestProviderProfile(profileId: number, token: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const alreadyOwned = await getProviderProfileByIdAndUserId(profileId, userId);
  if (alreadyOwned?.isComplete && alreadyOwned.guestTokenHash === null) return alreadyOwned;
  const tokenHash = hashGuestToken(token);
  const guest = await getGuestProviderProfileByToken(profileId, token);
  if (!guest || !guest.isComplete || guest.userId !== null) return undefined;
  await db.update(providerProfiles).set({ userId, guestTokenHash: null }).where(and(
    eq(providerProfiles.id, profileId),
    eq(providerProfiles.guestTokenHash, tokenHash),
    eq(providerProfiles.isComplete, true),
    isNull(providerProfiles.userId),
  ));
  const claimed = await getProviderProfileByIdAndUserId(profileId, userId);
  return claimed?.isComplete && claimed.guestTokenHash === null ? claimed : undefined;
}

export async function listPortfolioItems(profileId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(portfolioItems).where(eq(portfolioItems.profileId, profileId)).orderBy(desc(portfolioItems.createdAt));
}

export async function addPortfolioItem(data: {
  profileId: number;
  title: string;
  description: string;
  specialty: string;
  imageKey: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(portfolioItems).values(data);
  return listPortfolioItems(data.profileId);
}

export async function removeProviderProfile(profileId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(portfolioItems).where(eq(portfolioItems.profileId, profileId));
  await db.delete(providerProfiles).where(eq(providerProfiles.id, profileId));
}
