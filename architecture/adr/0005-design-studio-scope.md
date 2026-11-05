---
status: accepted
recorded: 2026-11-02
---
# Finish the production studio first and defer the participant platform

The current product scope is **drawing and brand sources → 3D and Design → captures and PDF planning document**. Instead of splitting the product into organizer and participant sides, keep a single editing flow, and leave a platform for per-company booth submission, assignment, application, approval and payment as a future plan. This decision reflects the user-chosen product scope in the actual code boundaries.

## Consequences and constraints

- Booth design within a general space stays. Having a shape or zone called a booth does not create a participating company or approval rights.
- The old participant page redirects to Studio and the old booth API returns `410 PLATFORM_DEFERRED`. Past booth data is not deleted or automatically merged into new projects.
- The current planning document can contain booth descriptions, planned circulation and an estimated participation fee with stated assumptions. This is document content, not a restoration of real pricing, application or payment features.
- The local private platform plan is a future scenario. Resuming organization, permission, event, submission or review features requires a new decision settling data ownership, access control, state transitions and migration.

Evidence: [current product scope](../../web/README.md#current-product-scope), [deferred response](../../web/server/plans/platform-deferred.ts), [old participant link](../../web/app/participate/[projectId]/page.tsx), [integration regression](../../integration/retired-platform.test.ts), [planning document service](../../web/server/plans/planning.ts). Implementation history: `c1f172e`.
