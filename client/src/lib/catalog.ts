export const SPECIALTIES = [
  "Arquiteto", "Azulejista", "Calheiro", "Carpinteiro", "Eletricista", "Encanador",
  "Engenheiro Civil", "Gesseiro", "Instalador Ar-Condicionado", "Limpeza de Obra",
  "Marceneiro", "Outros", "Paisagista", "Pedreiro", "Pintor", "Serralheiro",
  "Servente de Pedreiro", "Topógrafo", "Vidraceiro",
] as const;

export type Specialty = typeof SPECIALTIES[number];

export type PortfolioItem = {
  id: number;
  profileId: number;
  title: string;
  description: string;
  specialty: string;
  imageKey: string;
  createdAt: Date | string;
};

export type Provider = {
  id: number | string;
  userId?: number;
  companyName: string;
  professionalName: string;
  phone: string;
  whatsapp: string;
  specialties: string[];
  description: string;
  ratingAverage?: number;
  ratingCount?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  portfolio?: PortfolioItem[];
  demo?: boolean;
};

// Fictitious examples, clearly marked in the interface; no invented contact data.
export const DEMO_PROVIDERS: Provider[] = [
  {
    id: "demo-gabriel",
    companyName: "Gabriel SA",
    professionalName: "Gabriel",
    phone: "",
    whatsapp: "",
    specialties: ["Paisagista"],
    description: "Tenho habilidade com paisagismo.",
    portfolio: [],
    demo: true,
  },
  {
    id: "demo-selma",
    companyName: "Selma SA",
    professionalName: "Selma",
    phone: "",
    whatsapp: "",
    specialties: ["Arquiteto"],
    description: "Projetos e soluções para transformar ambientes.",
    portfolio: [],
    demo: true,
  },
];

export function getSpecialties(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function phoneHref(value: string) {
  const normalized = digits(value);
  return normalized.length >= 10 ? `tel:+55${normalized.replace(/^55/, "")}` : undefined;
}

export function whatsappHref(value: string) {
  const normalized = digits(value);
  return normalized.length >= 10 ? `https://wa.me/55${normalized.replace(/^55/, "")}` : undefined;
}
