---
status: superseded by ADR-0011
recorded: 2026-11-02
---
# Next.js owns the app and model work; Python owns computation

Current change: [ADR-0010](0010-retire-layout-engine.md) removes the old computation and [ADR-0011](0011-nextjs-document-preparation.md) replaces the service boundary and drawing contract. What follows is the record of the decision at the time.

Screens, model work and saved state change for different reasons and run in different environments than drawing extraction and geometry computation. Keep the existing Next.js + FastAPI structure: Next.js owns the app API, model calls, work orchestration and projects; Python owns extraction, optimization and checks. Keep the boundary by not putting UI state or model calls in the computation server, and do not add a third server, durable job system or database just to reorganize.

## Consequences and revisit conditions

- The browser uses the Next.js API. Engine HTTP calls are gathered in `web/server/engine/client.ts` so configuration, response validation, timeouts and cancellation are shared.
- HTTP handlers map inputs/responses, and reusable logic lives in feature modules. Server-only code is kept separate from browser/shared pure code.
- Python's optional disk cache holds disposable computation results. The cache's cross-process limits and retention, and parallel solver results, are not treated as an absolute reproducibility guarantee.
- If a requirement arises for work to continue after a disconnect or process restart, revisit the request lifetime and execution structure. Do not describe the current structure as a durable job queue.

Evidence: [root rules](../../AGENTS.md), [engine rules](../../engine/AGENTS.md), [central engine client](../../web/server/engine/client.ts), [engine cache](../../engine/app/layout/cache.py). Boundary cleanup history: `304a921`, `3214e2c`.
