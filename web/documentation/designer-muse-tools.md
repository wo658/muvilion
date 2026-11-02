# Designer Muse tools

Initial design and revision both use `designPlan` and the same request-scoped
`ToolLoopAgent`. A document with existing objects, zones or wall surfaces is a revision; an empty
space is initial design. There is no separate post-processing agent.

Muse prioritizes editable interiors and brand expression; existing-wall scanning is
optional supporting evidence, not a prerequisite. Scale and usable boundaries still
constrain the design. Attached references supply evidence; proposed brand directions and
unverified heights must be identified as assumptions.

## Tools

- `set_design_brief`: records a fixed model-authored direction and deliverables before
  drafting. Interior briefs must include physical installations, not just zoning.
  User quantities and requested furnishings must be preserved.

- `edit_design`: validates an atomic group and streams its changes for immediate saving as one undo operation. Objects, zones and wallSurfaces have independent upsert/removal lists. Surface designs attach to an existing wall line or partition, stay within its height and preserve source geometry. Delete a host and its surfaces together.

- `review_design`: reviews the accumulated draft (omit replacement collections),
  computes geometry warnings and requirement coverage separately, and renders plan
  and isometric PNG evidence. Coverage links requirement IDs to real object/zone/wall-surface IDs
  and checks kind/count; missing or invalid links prevent submission. It does not
  score aesthetics or independently establish faithfulness of the model-written brief.
- `generate_design_concept`: calls Meta Muse Image using selected reference images
  and the latest draft schematic. Uses the key saved in Settings, falling back to `MODEL_API_KEY`. Available with a key unless
  `MUSE_IMAGE_ENABLED=false`. `META_IMAGE_MODEL` defaults to `muse-image-1.0`.
- `submit_design`: references the last visually reviewed revision to finish the live run.
  It sends only revision and summary, avoiding a second large geometry generation.
  The server returns the exact reviewed draft and rejects stale or unseen revisions.

Generated concepts and deterministic schematics are separately labelled in the
proposal. Schematics show massing/color, not finished materials, lighting, meshes,
or eye-level sightlines. Surface colors and lettering appear in schematics, but PBR textures are visible in the 3D view. Ceiling is checked numerically. Wall surfaces are zero-thickness treatments, not verified construction.
Images are request-local, returned for review, and not embedded in saved plans.
Model summaries are design judgments, not measured aesthetic scores.

## Adding design asset or 3D tools

Register a `ToolRegistration<DesignToolContext>` in
`server/agent/tools/design-tools.ts`. The common registry handles names, phase
eligibility and availability; the SDK handles execution and tool results. An
extension can also be passed to `createDesignTools` in composition/tests. Names
must be unique. Categories are `design`, `image`, `asset`, and `3d`.

Factories receive an isolated draft, selected sources, environment, abort signal,
call budgets and artifacts. Call `reserveToolCall` before external work and pass
`context.signal` into the adapter. Use `addArtifact` for visual evidence: it queues
images for the next model step, avoiding chat-completions providers that stringify
image tool results. Do not expose credentials in tool inputs/results. Do not mutate the request's original plan; publish validated draft deltas through the operation stream.

No SAM 3D service is configured. A future asset/3D adapter must define its actual
provider, returned asset contract, provenance and import path. Categories do not
imply those capabilities are available. Adding metadata alone does not enable tools.

## Limits and verification

Streaming runs have up to 24 model steps (10 without previews), a shared 600-second
abort deadline, sequential tool execution, up to 16 successful edit calls,
3 visual reviews and at most 2 concept generations. Image requests have a
45-second deadline and bounded response bytes/pixels. Failed edits do not consume
the successful-edit budget. A failed review preflight returns diagnostics without
consuming a visual review; already accepted operations remain saved.
The submitted revision must match the last candidate whose images were sent to a
subsequent model step. Objects, zones and wall surfaces come from that stored draft.
Failures log a run ID, reason, total elapsed time, completed step count, tool names,
revision and unmet requirement counts, never prompts, references, keys or raw provider
errors. Per-step timing and rejection details are not retained in production; temporary
local instrumentation is needed for detailed live-run diagnosis.

Wall surfaces support color, catalog PBR material, literal lettering and stripe/frame
graphics on each face. They are saved/exported with the drawing and participate in
undo. They cannot stand in for floor furnishings, add physical depth, invent walls,
reconstruct logos or apply arbitrary uploaded graphics.

Tests cover extension availability, state isolation, PNG output, invalid input,
budgets, image API failure/cancellation and final-review enforcement. Live model
quality must be evaluated with representative briefs; mocked tests do not establish
visual quality or real provider access.

Meta API reference: https://dev.meta.ai/docs/image-generation
