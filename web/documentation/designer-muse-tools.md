# Designer Muse tools

Initial design and revision both use `designPlan` and the same request-scoped
`ToolLoopAgent`. A document with existing objects or zones is a revision; an empty
space is initial design. There is no separate post-processing agent.

## Tools

- `review_design`: stages a complete candidate without changing the user's document,
  computes existing geometry warnings, and renders plan and isometric PNG evidence.
- `generate_design_concept`: calls Meta Muse Image using selected reference images
  and the latest draft schematic. Available when `MODEL_API_KEY` exists unless
  `MUSE_IMAGE_ENABLED=false`. `META_IMAGE_MODEL` defaults to `muse-image-1.0`.
- `submit_design`: submits the last visually reviewed geometry for user Apply.

Generated concepts and deterministic schematics are separately labelled in the
proposal. Schematics show massing/color, not finished materials, lighting, meshes,
or eye-level sightlines. Ceiling is checked numerically; walls are floor lines.
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
image tool results. Do not expose credentials in tool inputs/results. Do not mutate
the original plan, import unselected references, or automatically apply changes.

No SAM 3D service is configured. A future asset/3D adapter must define its actual
provider, returned asset contract, provenance and import path. Categories do not
imply those capabilities are available. Adding metadata alone does not enable tools.

## Limits and verification

Runs have 8 model steps, a shared 75-second abort deadline, sequential tool execution,
3 candidate reviews and at most 2 concept generations. Image requests have a
45-second deadline and bounded response bytes/pixels. Failed tools are returned to
the model by the SDK; failures never count as reviews. Final submitted objects/zones
must match the last candidate whose images were sent to a subsequent model step.
The original user Apply and stale-proposal checks remain in force.

Tests cover extension availability, state isolation, PNG output, invalid input,
budgets, image API failure/cancellation and final-review enforcement. Live model
quality must be evaluated with representative briefs; mocked tests do not establish
visual quality or real provider access.

Meta API reference: https://dev.meta.ai/docs/image-generation
