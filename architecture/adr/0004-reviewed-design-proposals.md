---
status: superseded by ADR-0013 for design
recorded: 2026-11-02
---
# Model spatial changes are returned as reviewed proposals and applied by the user

Current change: [ADR-0013](0013-atomic-muse-operations.md) replaced proposal and Apply for spatial design with immediate per-operation commits. Line review results still use proposal and Apply as decided below.

If natural-language requests or intermediate generation states are treated directly as project changes, failures, cancellations and misunderstandings are hard to undo. The server validates intent to route the work, and spatial design is returned as a proposal that has gone through a per-request draft, geometry checks and visual review. Spatial changes to the project happen on the user's Apply.

## Consequences and constraints

- Ambiguous intent asks for confirmation, and model failures are not replaced with arbitrary spatial changes.
- Draft edits and reviews happen in the same per-request job. Submission references the last visually reviewed revision and does not submit regenerated geometry.
- Live draft and Muvi work animations are temporary displays. They are not evidence of autosave, successful execution or completed validation.
- When the drawing or reference sources change, stale proposals are not applied as-is.
- Deterministic geometry checks, checks that required items exist, the model's visual judgment and human approval have distinct meanings. Model response fixtures in tests are not a measure of real model quality.
- Text edits and photo requests for the planning document are a separate document flow ([0007](0007-persistent-planning-artifacts.md)). Do not confuse document editing with the spatial Apply rules.
- If job recovery after restart or long-running collaboration becomes necessary, revisit the execution boundary in [0001](0001-service-boundaries.md).

Evidence: [intent routing](../../web/server/plans/intent.ts), [design service](../../web/server/plans/design.ts), [Studio chat](../../web/components/studio/studio-chat.tsx), [tool contract](../../web/documentation/designer-muse-tools.md), [design loop test](../../web/tests/designer-loop.test.ts).
