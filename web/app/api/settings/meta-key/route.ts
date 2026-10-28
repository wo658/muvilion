import { changeKey, keyStatus, localSettingsRequest } from "@/server/settings/meta-key";
import { MetaKeyAction } from "@/lib/meta-key";

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  if (!localSettingsRequest(req)) return reply({ error: "Open settings on localhost." }, 403);
  try { return reply(keyStatus()); }
  catch { return reply({ error: "Could not read local settings." }, 500); }
}

export async function POST(req: Request) {
  if (!localSettingsRequest(req)) return reply({ error: "Open settings on localhost." }, 403);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "Expected JSON." }, 415);
  const raw = await req.text();
  if (raw.length > 8192) return reply({ error: "Request is too large." }, 413);
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return reply({ error: "Invalid request." }, 400); }
  const parsed = MetaKeyAction.safeParse(input);
  if (!parsed.success) return reply({ error: "Enter a non-empty API key without spaces." }, 400);
  try {
    if (parsed.data.action === "import" && !process.env.MODEL_API_KEY?.trim()) return reply({ error: "No MODEL_API_KEY is available in the server environment." }, 409);
    return reply(changeKey(parsed.data));
  } catch { return reply({ error: "Could not update local settings." }, 500); }
}
