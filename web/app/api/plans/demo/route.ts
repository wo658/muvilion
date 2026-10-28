import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const showcase = params.get("venue") === "fort-mason" && params.get("artifact") === "showcase";
  const spatial = params.get("venue") === "fort-mason" && params.get("artifact") === "spatial";
  const reviewed = showcase || spatial || (params.get("venue") === "fort-mason" && params.get("artifact") === "reviewed");
  const filename = showcase ? "fort-mason-meta-muse-plan.json" : spatial ? "fort-mason-spatial-design-plan.json" : reviewed ? "fort-mason-reviewed-plan.json" : params.get("venue") === "fort-mason" ? "fort-mason-ground-floor.pdf" : params.get("venue") === "coex" ? "coex-hall-a-2024.pdf" : "san-jose-mcenery-floor-plan-and-specs.pdf";
  const directories = process.env.DEMO_DATA_DIR ? [process.env.DEMO_DATA_DIR] : [resolve(process.cwd(), "../DemoData"), resolve(process.cwd(), "../../../DemoData")];
  for (const directory of directories) {
    try {
      const file = await readFile(resolve(directory, filename));
      if (!reviewed && file.subarray(0, 5).toString() !== "%PDF-") continue;
      return new Response(file, { headers: { "Content-Type": reviewed ? "application/json" : "application/pdf", "Content-Disposition": `inline; filename="${filename}"`, "Cache-Control": "private, no-store" } });
    } catch { /* Try the local checkout's demo directory. */ }
  }
  return Response.json({ error: `The local demo file ${filename} is missing. Place it in DemoData or set DEMO_DATA_DIR, or upload your own plan.` }, { status: 404 });
}
