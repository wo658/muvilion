---
status: accepted
recorded: 2026-11-02
---
# All model work goes through Muse, bound in a propose-validate-apply loop

muvilion has many tasks that need a model, from reading drawings to design, captures and planning documents. Instead of using a different model or provider per task, everything is unified on Meta's Muse family. All calls go through a single model entry point in Next.js ([ADR-0001](0001-service-boundaries.md)). Muse output is received as structured proposals, code validates it deterministically, and results that change space are applied after user review. This lets Muse be used broadly, for drawing understanding (vision), a tool-using agent, visual review of its own results and document writing, without model output becoming the project's source of truth unvalidated.

## Models and entry point

- Text, vision and tool calls: Muse Spark. The default is `muse-spark-1.3` on the Meta Model API, and it can be switched to the open weights `meta-models/muse-spark-open-1026` on Baseten. Both are obtained through the single [`getModel()`](../../web/server/agent/model.ts).
- Image generation: Muse Image (`muse-image-1.0`). Used only in the [concept image call](../../web/server/agent/tools/meta-image.ts).
- The Muse Spark key lives in the settings screen (SQLite) or `web/.env.local`. Muse Image currently reads only the `MODEL_API_KEY` environment variable. Without a key, each feature returns 503 with setup guidance and does not fabricate results.

## Where it applies

| Stage | Muse's role | Input | Safeguard on the result |
| --- | --- | --- | --- |
| Drawing reading | Find wall segments, text and scale evidence (bars, dimension lines, areas) in uploaded and sample drawing previews ([ADR-0008](0008-muse-pdf-wall-tracing.md)) | Rendered image | Code computes meters, short evidence is enlarged and re-read, scale left unconfirmed, error after one retry ([ADR-0011](0011-nextjs-document-preparation.md)) |
| Drawing analysis | Classify extracted lines as walls or dimension lines, second-pass audit of the full drawing | Per-region cropped images, line IDs | Only received IDs allowed, confidence below 0.7 stays unclassified |
| Request classification | Split chat messages into design, conversation, analysis or clarification | User message, selection state | Only picks the next step, without running tools |
| Conversation | Space and brand consultation | Drawing evidence (without image bytes), reference sources | Does not claim edits or validation were completed |
| Spatial design | Designer Muse tool agent: record brief → search assets → edit → self-review from plan and isometric renders → submit | Drawing, brief, reference images | Geometry, circulation and seating checks return blocking issues. Applied only when the user clicks Apply ([ADR-0004](0004-reviewed-design-proposals.md)) |
| Concept images | Generate design direction drafts (Muse Image) | Reference images, current draft | Marked as not editable geometry. Not presented as real captures |
| Photo direction | Plan capture intent and camera, then readjust after viewing real 3D captures | Scene summary, browser capture images | Limited number of rounds, captures only the real scene |
| Planning document | Write and edit section and booth copy, request captures | Planning document, booth geometry, reference sources | Changes only allowed sections and IDs, does not change geometry ([ADR-0007](0007-persistent-planning-artifacts.md)) |

## Common rules

- Output is received as tool calls (zod schemas) and validated again against the schema and business rules. State is not changed by parsing free text.
- Drawing text and reference sources are passed as untrusted data, and the prompts state explicitly that instructions inside them must not be followed.
- Muse estimates (wall positions, scale, confidence) are marked as approximate. Do not claim surveyed accuracy, structural safety or code compliance was checked.
- Failures end in a clear error or a marked fallback result. They are not dressed up as success, and the reason is written to the server log.

## Revisit conditions

If another model is clearly better at a specific task, or the Muse API's features, cost or latency do not meet requirements, decide in a new ADR whether to switch only that task to another model. Even then, keep the `getModel()` entry point and the propose-validate-apply loop.

Evidence: [model entry point](../../web/server/agent/model.ts), [wall tracing](../../web/server/plans/trace.ts), [line classification](../../web/server/plans/interpret.ts), [request classification](../../web/server/plans/intent.ts), [conversation](../../web/server/plans/chat.ts), [design agent](../../web/server/plans/design.ts), [design tools](../../web/server/agent/tools/design-tools.ts), [photo direction](../../web/server/plans/photography.ts), [planning document](../../web/server/plans/planning.ts), [prompts](../../web/server/plans/prompts.ts).
