import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Optional local assets, not bundled application state. Filenames never come from requests.
const EXAMPLES = {
  "san-jose": { source: "san-jose-mcenery-floor-plan-and-specs.pdf" },
  coex: { source: "coex-hall-a-2024.pdf" },
  "fort-mason": {
    source: "fort-mason-ground-floor.pdf",
    reviewed: "fort-mason-reviewed-plan.json",
    spatial: "fort-mason-spatial-design-plan.json",
    showcase: "fort-mason-meta-muse-plan.json",
  },
} as const;

export async function loadExample(params: URLSearchParams) {
  const venue = params.get("venue");
  const entry = venue === "fort-mason" ? EXAMPLES[venue] : venue === "coex" ? EXAMPLES.coex : EXAMPLES["san-jose"];
  const artifact = params.get("artifact");
  const filename = venue === "fort-mason" && (artifact === "reviewed" || artifact === "spatial" || artifact === "showcase")
    ? EXAMPLES["fort-mason"][artifact] : entry.source;
  const contentType = filename.endsWith(".json") ? "application/json" : "application/pdf";
  const directory = process.env.DEMO_DATA_DIR ?? resolve(process.cwd(), "../DemoData");
  try {
    const file = await readFile(resolve(directory, filename));
    if (contentType === "application/pdf" && file.subarray(0, 5).toString() !== "%PDF-") return { file: null, filename, contentType };
    return { file, filename, contentType };
  } catch {
    return { file: null, filename, contentType };
  }
}
