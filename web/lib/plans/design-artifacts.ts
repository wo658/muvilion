import { z } from "zod";

export const DesignArtifactSchema = z.object({
  id: z.string().max(100),
  kind: z.enum(["schematic", "concept"]),
  title: z.string().max(200),
  revision: z.number().int().nonnegative(),
  image: z.string().max(4_000_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),
});
export type DesignArtifact = z.infer<typeof DesignArtifactSchema>;
export const DesignArtifactsSchema = z.array(DesignArtifactSchema).max(8);
