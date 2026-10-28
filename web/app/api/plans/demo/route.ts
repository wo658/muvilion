import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function GET(request: Request) {
  const filename = new URL(request.url).searchParams.get("venue") === "coex"
    ? "coex-hall-a-2024.pdf" : "san-jose-mcenery-floor-plan-and-specs.pdf";
  const directories = process.env.DEMO_DATA_DIR ? [process.env.DEMO_DATA_DIR] : [resolve(process.cwd(), "../DemoData"), resolve(process.cwd(), "../../../DemoData")];
  for (const directory of directories) {
    try {
      const file = await readFile(resolve(directory, filename));
      if (file.subarray(0, 5).toString() !== "%PDF-") continue;
      return new Response(file, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"`, "Cache-Control": "private, no-store" } });
    } catch { /* Try the local checkout's demo directory. */ }
  }
  return Response.json({ error: "The local demo PDF is missing. Place it in DemoData or set DEMO_DATA_DIR, or upload your own plan." }, { status: 404 });
}
