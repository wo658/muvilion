import { z } from "zod";
export const PricingContextSchema = z.array(z.object({
  name: z.string().max(100), width: z.number().positive(), depth: z.number().positive(),
  price: z.number().min(0).max(1_000_000_000), description: z.string().max(4000),
  published: z.boolean(),
})).max(200);
export type PricingContext = z.infer<typeof PricingContextSchema>;
