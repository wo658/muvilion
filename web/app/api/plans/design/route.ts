import { generateText, tool } from "ai";
import { z } from "zod";
import { getModel } from "@/server/agent/model";
import { PlanDocumentSchema } from "@/lib/plans/schema";
import { applyDesignProposal, DESIGN_INSTRUCTIONS, PlanDesignProposal, planChatContext } from "@/lib/plans/muse";

import { SourceRequestSchema, sourceContent, SOURCE_INSTRUCTIONS } from "@/lib/sources/schema";

export const maxDuration = 90;
const DesignRequest = z.object({ sources: SourceRequestSchema, drawingSelected: z.boolean().default(true), document: PlanDocumentSchema, brief: z.string().trim().min(1).max(6000) });

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 32 * 1024 * 1024) return Response.json({ error: "Drawing request is too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = DesignRequest.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Provide a valid drawing and design brief." }, { status: 400 });
  const { document, brief } = parsed.data;
  if (!document.scaleConfirmed) return Response.json({ error: "Confirm the drawing scale before drafting a layout." }, { status: 400 });
  const model = getModel();
  if (!model.hasKey) return Response.json({ error: "Muse is not configured. Add a Meta API key in Settings or set MODEL_API_KEY in web/.env.local." }, { status: 503 });
  try {
    const result = await generateText({
      model: model.model,
      instructions: DESIGN_INSTRUCTIONS + "\n" + SOURCE_INSTRUCTIONS,
      messages: [{ role: "user", content: [{ type: "text", text: JSON.stringify({ brief, context: planChatContext({ ...document, texts: parsed.data.drawingSelected ? document.texts : [] }), wallLines: document.lines.filter(line => line.kind === "wall") }) }, ...sourceContent(parsed.data.sources)] }],
      tools: { submit_design: tool({ description: "Submit editable space zones, physical installations with heights, and assumptions for user review. Existing source and ceiling conditions remain unchanged.", inputSchema: PlanDesignProposal }) },
      toolChoice: "auto",
      temperature: 0.2, maxRetries: 1, timeout: 75_000, abortSignal: req.signal,
    });
    const call = result.toolCalls.find(item => item.toolName === "submit_design");
    if (!call) return Response.json({ error: "Muse did not return a design. Please retry." }, { status: 502 });
    const proposal = PlanDesignProposal.parse(call.input);
    return Response.json({ document: applyDesignProposal(document, proposal), summary: proposal.summary });
  } catch {
    return Response.json({ error: "Muse could not draft a layout. Check the API configuration or retry; your drawing is unchanged." }, { status: 502 });
  }
}
