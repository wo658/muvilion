import { z } from "zod";
import { DesignObjectSchema, PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";

export const BoothInputSchema = z.object({
  zoneId: z.string().min(1).max(100), name: z.string().trim().min(1).max(100),
  price: z.number().int().min(0).max(1_000_000_000), currency: z.literal("KRW").default("KRW"),
  maxHeight: z.number().positive().max(30), description: z.string().max(4000).default(""),
});
export const CreateBoothProjectSchema = z.object({
  title: z.string().trim().min(1).max(200), document: PlanDocumentSchema,
  booths: z.array(BoothInputSchema).min(1).max(100),
});
export const UpdateBoothProjectSchema = z.object({ booths: z.array(BoothInputSchema.omit({ zoneId: true }).extend({ id: z.string().min(1).max(100) })).min(1).max(100) });
export const ApplyForBoothSchema = z.object({
  boothId: z.string().min(1).max(100), company: z.string().trim().min(1).max(200),
  contactName: z.string().trim().min(1).max(100), email: z.string().trim().email().max(255),
  brief: z.string().trim().min(1).max(6000),
});
export const ReviewApplicationSchema = z.object({ status: z.enum(["approved", "rejected"]) });
export const SaveBoothDesignSchema = z.object({
  objects: z.array(DesignObjectSchema).max(80), notes: z.string().max(6000).default(""),
  buildNotes: z.string().max(12000).default(""), status: z.enum(["draft", "submitted"]).default("draft"),
});
export type BoothListing = z.infer<typeof BoothInputSchema> & { id: string; width: number; depth: number; available: boolean };
export type BoothDesign = z.infer<typeof SaveBoothDesignSchema> & { updatedAt: string };
export type BoothApplication = z.infer<typeof ApplyForBoothSchema> & {
  id: string; status: "pending" | "approved" | "rejected"; createdAt: string; design?: BoothDesign;
  quotedPrice: number; currency: "KRW";
};
export type PublicBoothProject = { id: string; title: string; booths: BoothListing[]; space: PlanDocument; createdAt: string };
export type OrganizerBoothProject = PublicBoothProject & { document: PlanDocument; applications: BoothApplication[] };
export type BoothApplicationAccess = { application: BoothApplication; booth: BoothListing; document: PlanDocument };
