import { z } from "zod";

export const MetaKeyAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), key: z.string().trim().min(1).max(4096).regex(/^[\x21-\x7e]+$/) }),
  z.object({ action: z.literal("import") }),
  z.object({ action: z.literal("remove") }),
]);
export const MetaKeyStatus = z.object({
  stored: z.boolean(),
  environmentAvailable: z.boolean(),
  activeProvider: z.enum(["meta", "baseten"]),
  source: z.enum(["sqlite", "environment", "none"]),
});
export type MetaKeyStatus = z.infer<typeof MetaKeyStatus>;
