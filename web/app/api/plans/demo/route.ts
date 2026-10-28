import { loadExample } from "@/server/examples/load";

export async function GET(request: Request) {
  const example = await loadExample(new URL(request.url).searchParams);
  if (!example.file) return Response.json({ error: `The local demo file ${example.filename} is missing. Place it in DemoData or set DEMO_DATA_DIR, or upload your own plan.` }, { status: 404 });
  return new Response(example.file, { headers: { "Content-Type": example.contentType, "Content-Disposition": `inline; filename="${example.filename}"`, "Cache-Control": "private, no-store" } });
}
