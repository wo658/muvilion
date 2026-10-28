import { generateText, tool } from "ai";
import { getModel } from "@/server/agent/model";
import { PlanDocumentSchema } from "@/lib/plans/schema";
import { applyInterpretation, interpretationEvidence, INTERPRET_INSTRUCTIONS, PlanInterpretation } from "@/lib/plans/muse";

export const maxDuration = 90;

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 8 * 1024 * 1024) return Response.json({ error: "Drawing request is too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = PlanDocumentSchema.safeParse((body as { document?: unknown } | null)?.document);
  if (!parsed.success) return Response.json({ error: "Invalid drawing document." }, { status: 400 });
  const document = parsed.data;
  if (!document.lines.some((line) => line.kind === "unknown")) return Response.json({ error: "No unclassified lines to review." }, { status: 400 });
  if (document.lines.filter(line => line.kind === "unknown").length > 600) return Response.json({ error: "Use regional analysis for more than 600 candidates." }, { status: 422 });
  const model = getModel();
  if (!model.hasKey) return Response.json({ error: "Muse is not configured. Add a Meta API key in Settings or set MODEL_API_KEY in web/.env.local." }, { status: 503 });
  try {
    const result = await generateText({
      model: model.model,
      instructions: INTERPRET_INSTRUCTIONS + ((body as { reviewMode?: unknown }).reviewMode === "global-wall-audit" ? "\nThis is a second-pass whole-plan audit of proposed walls. Inspect the ENTIRE layout before confirming each candidate. Long lines crossing an open labelled hall can be floor service trenches, tracks, grids or movable division guides, not walls. Repeated parallel floor features without enclosing room topology are not sufficient wall evidence. Confirm wall only when whole-plan context supports an actual vertical enclosure/partition; otherwise return unknown. Never promote a line just because the first pass proposed it." : ""),
      messages: [{ role: "user", content: [
        { type: "text", text: JSON.stringify(interpretationEvidence(document)) },
        { type: "file", data: document.preview, mediaType: "image/png" },
      ] }],
      tools: { submit_interpretation: tool({ description: "Submit classifications for supplied line IDs and uncertainties.", inputSchema: PlanInterpretation }) },
      toolChoice: "auto",
      temperature: 0.1,
      maxRetries: 1,
      timeout: 75_000,
      abortSignal: req.signal,
    });
    const call = result.toolCalls.find((item) => item.toolName === "submit_interpretation");
    if (!call) return Response.json({ error: "Muse did not return classifications. Please retry." }, { status: 502 });
    const interpretation = PlanInterpretation.parse(call.input);
    return Response.json({ document: applyInterpretation(document, interpretation), summary: interpretation.summary });
  } catch {
    return Response.json({ error: "Muse could not interpret this drawing. Check the API configuration or retry; your drawing is unchanged." }, { status: 502 });
  }
}
