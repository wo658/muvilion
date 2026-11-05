---
status: accepted
recorded: 2026-11-03
---
# Commit Muse work immediately in atomic operations

[ADR-0004](0004-reviewed-design-proposals.md) returned the whole spatial design result as a reviewed proposal and applied it on user Apply. A single design takes several minutes, and on an intermediate failure, cancellation or disconnect everything built so far was lost (Moscone West L3 first automatic design: cancelled at 6.9 minutes after 8 `edit_design` calls, 0 saved), and undo was only a single step for the whole design. By user decision, Muse's work is split into operations and committed to the project as soon as each arrives. This supersedes ADR-0004's design Apply step and [ADR-0012](0012-muse-scale-floor-auto-design.md)'s "only the first automatic design is an exception" rule. Line review results remain proposal + Apply.

## Units

- Design: one `edit_design` call (a labeled batch of up to 32 elements, for example one booth and its components) and a passing `review_design` replacement are each one operation. A single element is too fine (200 elements = 200 undos), and the whole run is too coarse. If the final reviewed revision differs from the last streamed result, that difference is also committed as one operation.
- Drawing reading: source preview (opening the drawing) → wall tracing (including scale evidence) → floor outline. A failure in a later stage keeps the earlier stages. Stages merge into the current drawing, so they do not overwrite a scale or outline the user set in the meantime.

## Atomicity and validation

- For each operation, the server compares geometry warnings before and after applying it, holds back items that create new overlaps, go outside the floor/drawing, block aisles or cross walls, and commits only the remaining items as one operation (changed 2026-11-03). Deletions are judged together as one unit, and items that depend on held-back zones or partitions are held back with them. The model receives the held-back items, the causing warnings and suggested placement coordinates, and is asked to resend only the held-back items. If no item can be saved, the batch is rejected and the draft and project stay unchanged. At first the whole batch was rejected, but in a Seongsu pop-up live run 4–7 of 12 batches were rejected because of a single item, re-running model steps that take 30–60 seconds per batch and exceeding the 600-second limit. Holding items back keeps the same guarantee that committed results have no new geometry problems. `sets` in `edit_design` (added 2026-11-04) are furniture groups such as meeting tables, lounges and fitting bars that the server expands according to seating rules (orientation, table spacing, clearance behind chairs), and they are saved or held back as a group. In live demo runs, when Muse placed seats one by one, seating review did not converge within 600 seconds and the floor was sparse. Expanded elements are ordinary objects with `<set id>-<part>` IDs, so the storage format does not change. Usability checks such as seat-table pairing, full-floor allocation and requirement linking may be temporarily unmet in intermediate stages, so they are checked in `review_design` as before.
- The client commits one streaming event as one undo step, the same as a regular edit. Changes other than documents committed by the run (user edits) or reference source changes stop the run.
- After completion or interruption, the run card shows a result summary and review; an interrupted run offers continue designing and undo the whole run (when no other changes followed).

## References and limits

References: tldraw's history mark/squash, tldraw agent's per-action application and sanitizing, SketchUp's operation commit/abort, the Figma MCP bridge's per-write checkpoints, Onshape's immutable microversions, and Agentic Designer's validate-then-commit per batch. This atomicity holds while the request is alive. Continuing a run after a server restart requires a durable job queue, which per AGENTS.md is revisited when that requirement arises. Undo history is session memory (last 40 steps), and no operation log is stored.

Evidence: [operation validation](../../web/lib/plans/design.ts), [design tools](../../web/server/agent/tools/design-tools.ts), [live commits](../../web/components/studio/studio-chat.tsx), [drawing reading stages](../../web/server/plans/extract.ts), [stage merging](../../web/lib/plans/trace.ts), [regression test](../../web/tests/plan-trace.test.ts).
