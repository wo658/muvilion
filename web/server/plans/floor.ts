import "server-only";
import { generateText, tool } from "ai";
import { getModel } from "@/server/agent/model";
import type { PlanDocument } from "@/lib/plans/schema";
import { PlanFloor } from "@/lib/plans/floor";
import { decodeToolInput } from "@/lib/plans/trace";
import { FLOOR_INSTRUCTIONS } from "./prompts";

/** Usable floor outline from the page image, read in parallel with walls. Failures leave the outline to the user. */
export async function traceFloorOutline(document: PlanDocument, signal: AbortSignal): Promise<PlanFloor | null> {
  try {
    const result = await generateText({
      model: (await getModel()).model,
      instructions: FLOOR_INSTRUCTIONS,
      messages: [{ role: "user", content: [
        { type: "text", text: JSON.stringify({ source: document.source, texts: document.texts.slice(0, 200) }) },
        { type: "file", data: document.preview, mediaType: "image/png" },
      ] }],
      tools: { submit_floor: tool({ description: "Submit the event floor outline.", inputSchema: PlanFloor }) },
      toolChoice: "auto",
      temperature: 0.1,
      maxRetries: 1,
      timeout: 90_000,
      maxOutputTokens: 16000,
      abortSignal: signal,
    });
    const call = result.toolCalls.find(item => item.toolName === "submit_floor");
    return call ? PlanFloor.parse(decodeToolInput(call.input)) : null;
  } catch (error) {
    signal.throwIfAborted();
    console.warn("[muse-floor]", error instanceof Error ? error.message.slice(0, 300) : String(error));
    return null;
  }
}
