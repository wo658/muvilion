import { readFile, writeFile } from "node:fs/promises";
import { PlanDocumentSchema } from "../../web/lib/plans/schema";
import { designWarnings } from "../../web/lib/plans/design";
const file = (name: string) => new URL(`./generated/${name}`, import.meta.url);
const { id } = JSON.parse(await readFile(file("project.json"), "utf8"));
const result = JSON.parse(await readFile(file("result.json"), "utf8"));
if (!result.designReview?.complete)
  throw new Error("Muse did not complete its review.");
const document = PlanDocumentSchema.parse(result.document);
// Explicit post-review clean-up, recorded separately from the original AI response.
const plant = document.objects!.find((o) => o.id === "plant-04")!;
plant.y = 0.65;
plant.provenance = "manual";
const stage = document.zones!.find((z) => z.id === "z-stage")!;
stage.depth = 4.8;
const warnings = designWarnings(document);
if (warnings.length) throw new Error(warnings.join("\n"));
const current = await (
  await fetch(`http://localhost:3000/api/projects/${id}`)
).json();
if (current.revision !== 0)
  throw new Error("Project changed during generation; refusing to overwrite.");
current.state.document = document;
const r = await fetch(`http://localhost:3000/api/projects/${id}`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
  },
  body: JSON.stringify({
    name: current.name,
    revision: current.revision,
    state: current.state,
  }),
});
if (!r.ok) throw new Error(await r.text());
await writeFile(file("final-document.json"), JSON.stringify(document, null, 2));
await writeFile(
  new URL("./generation-summary.json", import.meta.url),
  JSON.stringify(
    {
      source: document.source,
      method: document.method,
      objects: document.objects!.length,
      zones: document.zones!.length,
      aiReviewComplete: result.designReview.complete,
      postReviewAdjustments: [
        {
          id: "plant-04",
          field: "y",
          from: 0.68,
          to: 0.65,
          reason: "Remove overlap with stage",
        },
        {
          id: "z-stage",
          field: "depth",
          from: 4.6,
          to: 4.8,
          reason: "Include backdrop in its assigned zone",
        },
      ],
      remainingDesignWarnings: warnings,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ project: id, objects: document.objects!.length, warnings }),
);
