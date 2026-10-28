import { generateText, tool } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/agent/model";
import { PlanDocumentSchema } from "@/lib/plans/schema";
import { applyDesignProposal, DESIGN_INSTRUCTIONS, PlanDesignProposal, planChatContext } from "@/lib/plans/muse";

export const maxDuration = 90;
const DesignRequest = z.object({ document: PlanDocumentSchema, brief: z.string().trim().min(1).max(6000) });

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
  if (!model.hasKey) return Response.json({ error: "Muse is not configured. Add MODEL_API_KEY to web/.env.local." }, { status: 503 });
  try {
    const result = await generateText({
      model: model.model,
      instructions: DESIGN_INSTRUCTIONS,
      prompt: JSON.stringify({ brief, context: planChatContext(document), wallLines: document.lines.filter(line => line.kind === "wall") }),
      tools: { submit_design: tool({ description: "Submit a complete editable concept layout and assumptions for user review.", inputSchema: PlanDesignProposal }) },
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
