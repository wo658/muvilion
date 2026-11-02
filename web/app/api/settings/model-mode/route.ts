import { NextResponse } from "next/server";
import { MODEL_MODE_COOKIE, ModelMode } from "@/lib/model-mode";
import { getModel } from "@/server/agent/model";
import { localSettingsRequest } from "@/server/settings/meta-key";

async function status() {
  const model = await getModel();
  return { supported: model.provider === "meta" && /^muse-spark-1\.[23](-contributor)?$/.test(model.modelId),
    mode: model.modelId.endsWith("-contributor") ? "contributor" as const : "standard" as const, modelId: model.modelId };
}
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  if (!localSettingsRequest(req)) return reply({ error: "Open settings from the app origin." }, 403);
  return reply(await status());
}

export async function POST(req: Request) {
  if (!localSettingsRequest(req)) return reply({ error: "Open settings from the app origin." }, 403);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "Expected JSON." }, 415);
  const raw = await req.text();
  if (raw.length > 256) return reply({ error: "Request is too large." }, 413);
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return reply({ error: "Invalid request." }, 400); }
  const parsed = ModelMode.safeParse(input);
  if (!parsed.success) return reply({ error: "Invalid model mode." }, 400);
  const current = await status();
  if (!current.supported) return reply({ error: "This provider does not support Contributor mode." }, 409);
  const modelId = current.modelId.replace(/-contributor$/, "") + (parsed.data === "contributor" ? "-contributor" : "");
  const response = reply({ supported: true, mode: parsed.data, modelId });
  response.cookies.set(MODEL_MODE_COOKIE, parsed.data, { httpOnly: true, sameSite: "strict", secure: new URL(req.url).protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return response;
}
