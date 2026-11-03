import { z } from "zod";
import { PlanDocumentSchema, type PlanDocument } from "./schema";

const ReadingEvent = z.discriminatedUnion("type", [
  z.object({ type: z.enum(["preview", "walls", "floor"]), document: PlanDocumentSchema }),
  z.object({ type: z.literal("complete") }),
  z.object({ type: z.literal("error"), error: z.string() }),
]);
export type ReadingStepType = "preview" | "walls" | "floor";

/** Drawing reading stream: hand each completed step to the caller to commit; a later step failure keeps earlier ones. */
export async function readReadingStream(response: Response, onStep: (type: ReadingStepType, document: PlanDocument) => void) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.error === "string" ? body.error : "We could not read this drawing. Please try another file.");
  }
  if (!response.body) throw new Error("Missing drawing reading stream.");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = ReadingEvent.parse(JSON.parse(line));
        if (event.type === "error") throw new Error(event.error);
        if (event.type === "complete") return;
        onStep(event.type, event.document);
      }
    }
  } finally { reader.releaseLock(); }
  throw new Error("Drawing reading ended before completion.");
}
