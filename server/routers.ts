import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";

const specialties = [
  "Arquiteto", "Azulejista", "Calheiro", "Carpinteiro", "Eletricista", "Encanador",
  "Engenheiro Civil", "Gesseiro", "Instalador Ar-Condicionado", "Limpeza de Obra",
  "Marceneiro", "Outros", "Paisagista", "Pedreiro", "Pintor", "Serralheiro",
  "Servente de Pedreiro", "Topógrafo", "Vidraceiro",
] as const;

const profileFields = {
  companyName: z.string().trim().min(2).max(120),
  professionalName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(24),
  whatsapp: z.string().trim().max(24).default(""),
  specialties: z.array(z.enum(specialties)).min(1).max(10),
  description: z.string().trim().min(10).max(2000),
};
const profileEditInput = z.object({ profileId: z.number().int().positive().optional(), ...profileFields });
const serviceFields = {
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(""),
  specialty: z.enum(specialties),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  imageData: z.string().max(5_800_000),
};
const serviceInput = z.object({ profileId: z.number().int().positive(), ...serviceFields });
const guestCredential = { profileId: z.number().int().positive(), token: z.string().uuid() };
type ServiceDetails = Omit<z.output<typeof serviceInput>, "profileId">;

function parseSpecialties(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function safeProfile<T extends { guestTokenHash: string | null }>(profile: T): Omit<T, "guestTokenHash"> {
  return Object.fromEntries(Object.entries(profile).filter(([key]) => key !== "guestTokenHash")) as Omit<T, "guestTokenHash">;
}

function decodeServiceImage(contentType: string, imageData: string) {
  const prefix = `data:${contentType};base64,`;
  if (!imageData.startsWith(prefix)) throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo de imagem inválido." });
  const bytes = Buffer.from(imageData.slice(prefix.length), "base64");
  if (bytes.length === 0 || bytes.length > 4 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "A imagem precisa ter até 4 MB." });
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  return { bytes, extension };
}

async function withPortfolio(profile: Awaited<ReturnType<typeof db.getProviderProfileById>>) {
  if (!profile) return null;
  const portfolio = await db.listPortfolioItems(profile.id);
  return { ...safeProfile(profile), specialties: parseSpecialties(profile.specialties), portfolio };
}

async function storePortfolioImage(profileId: number, keyPrefix: string, input: ServiceDetails) {
  const { bytes, extension } = decodeServiceImage(input.contentType, input.imageData);
  try {
    const stored = await storagePut(`${keyPrefix}/${crypto.randomUUID()}.${extension}`, bytes, input.contentType);
    return db.addPortfolioItem({
      profileId,
      title: input.title,
      description: input.description,
      specialty: input.specialty,
      imageKey: stored.key,
    });
  } catch (error) {
    console.error("[Portfolio] Failed to upload item", error instanceof Error ? error.message : "unknown error");
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível enviar a imagem agora." });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  providers: router({
    list: publicProcedure.query(async () => {
      const rows = await db.listProviderProfiles();
      return Promise.all(rows.map(async row => {
        const ratings = await db.getProviderRatingSummary(row.id);
        return { ...safeProfile(row), specialties: parseSpecialties(row.specialties), ratingAverage: ratings.average, ratingCount: ratings.count };
      }));
    }),
    byId: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const profile = await db.getProviderProfileById(input.id);
      if (!profile || !profile.isComplete) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado" });
      const portfolio = await db.listPortfolioItems(profile.id);
      return { ...safeProfile(profile), specialties: parseSpecialties(profile.specialties), portfolio };
    }),
    ratingSummary: publicProcedure.input(z.object({
      profileId: z.number().int().positive(),
      voterId: z.string().uuid().optional(),
    })).query(async ({ input }) => {
      const profile = await db.getProviderProfileById(input.profileId);
      if (!profile?.isComplete) throw new TRPCError({ code: "NOT_FOUND", message: "Profissional não encontrado." });
      return db.getProviderRatingSummary(input.profileId, input.voterId);
    }),
    rate: publicProcedure.input(z.object({
      profileId: z.number().int().positive(),
      voterId: z.string().uuid(),
      stars: z.number().int().min(1).max(5),
    })).mutation(async ({ input }) => {
      const result = await db.saveProviderRating(input.profileId, input.voterId, input.stars);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Profissional não encontrado." });
      return result;
    }),
    guestDraft: publicProcedure.input(z.object(guestCredential)).query(async ({ input }) => {
      const profile = await db.getGuestProviderProfileByToken(input.profileId, input.token);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "O rascunho não foi encontrado." });
      return {
        ...safeProfile(profile),
        specialties: parseSpecialties(profile.specialties),
        portfolio: await db.listPortfolioItems(profile.id),
      };
    }),
    createGuestDraft: publicProcedure.input(z.object({ token: z.string().uuid(), ...profileFields })).mutation(async ({ input }) => {
      const { token, ...data } = input;
      const profile = await db.createGuestProviderProfile(data, token);
      return { id: profile.id };
    }),
    updateGuestProfile: publicProcedure.input(z.object({ ...guestCredential, ...profileFields })).mutation(async ({ input }) => {
      const { profileId, token, ...data } = input;
      const profile = await db.updateGuestProviderProfile(profileId, data, token);
      if (!profile) throw new TRPCError({ code: "FORBIDDEN", message: "Este cadastro visitante não pode ser alterado." });
      return { id: profile.id };
    }),
    mine: protectedProcedure.query(async ({ ctx }) => {
      const profile = await db.getProviderProfileByUserId(ctx.user.id);
      return withPortfolio(profile);
    }),
    mineList: protectedProcedure.query(async ({ ctx }) => {
      const profiles = await db.getProviderProfilesByUserId(ctx.user.id);
      return Promise.all(profiles.map(async profile => ({
        ...safeProfile(profile),
        specialties: parseSpecialties(profile.specialties),
        portfolio: await db.listPortfolioItems(profile.id),
      })));
    }),
    ownedById: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const profile = await db.getProviderProfileByIdAndUserId(input.id, ctx.user.id);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado nesta conta." });
      return withPortfolio(profile);
    }),
    save: protectedProcedure.input(profileEditInput).mutation(async ({ ctx, input }) => {
      const { profileId, ...data } = input;
      try {
        const profile = await db.saveProviderProfile(ctx.user.id, data, profileId);
        return { ...safeProfile(profile), specialties: parseSpecialties(profile.specialties) };
      } catch (error) {
        console.error("[Providers] Failed to save profile", error instanceof Error ? error.message : "unknown error");
        if (error instanceof Error && error.message === "Provider profile not found for this account") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Este perfil não pertence à sua conta." });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar seu perfil. Tente novamente." });
      }
    }),
    complete: protectedProcedure.input(z.object({ profileId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const profile = await db.completeProviderProfile(input.profileId, ctx.user.id);
        if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado." });
        return { id: profile.id, isComplete: profile.isComplete };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof Error && error.message === "Provider profile not found for this account") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Este perfil não pertence à sua conta." });
        }
        if (error instanceof Error && error.message === "At least one service photo is required before publishing") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Adicione pelo menos um serviço com foto antes de concluir o cadastro." });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível concluir o cadastro." });
      }
    }),
    completeGuest: publicProcedure.input(z.object(guestCredential)).mutation(async ({ input }) => {
      try {
        const profile = await db.completeGuestProviderProfile(input.profileId, input.token);
        if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Cadastro visitante não encontrado." });
        return { id: profile.id, isComplete: profile.isComplete };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof Error && error.message === "Guest provider profile not found") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Cadastro visitante não encontrado." });
        }
        if (error instanceof Error && error.message === "At least one service photo is required before publishing") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Adicione pelo menos um serviço com foto antes de concluir o cadastro." });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível concluir o cadastro." });
      }
    }),
    claimGuest: protectedProcedure.input(z.object(guestCredential)).mutation(async ({ ctx, input }) => {
      const profile = await db.claimGuestProviderProfile(input.profileId, input.token, ctx.user.id);
      if (!profile) throw new TRPCError({ code: "FORBIDDEN", message: "O cadastro não pode ser vinculado a esta conta." });
      return { id: profile.id };
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const profile = await db.getProviderProfileById(input.id);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado" });
      if (profile.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode remover este perfil." });
      }
      await db.removeProviderProfile(profile.id);
      return { id: profile.id, removed: true };
    }),
    addPortfolioItem: protectedProcedure.input(serviceInput).mutation(async ({ ctx, input }) => {
      const profile = await db.getProviderProfileByIdAndUserId(input.profileId, ctx.user.id);
      if (!profile) throw new TRPCError({ code: "FORBIDDEN", message: "Selecione um perfil da sua conta para enviar este trabalho." });
      const { profileId, ...service } = input;
      return storePortfolioImage(profileId, `portfolio/${ctx.user.id}/${profileId}`, service);
    }),
    addGuestPortfolioItem: publicProcedure.input(z.object({ ...guestCredential, ...serviceFields })).mutation(async ({ input }) => {
      const profile = await db.getGuestProviderProfileByToken(input.profileId, input.token);
      if (!profile || profile.userId !== null) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Este rascunho não está disponível para receber serviços." });
      }
      const { profileId, token: _token, ...service } = input;
      return storePortfolioImage(profileId, `portfolio/guest/${profileId}`, service);
    }),
  }),
});

export type AppRouter = typeof appRouter;
