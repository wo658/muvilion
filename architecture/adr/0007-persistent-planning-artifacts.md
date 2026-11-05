---
status: accepted
recorded: 2026-11-02
---
# Planning documents are stored per drawing and PDFs are output from them

Session captures alone do not let users reopen planning content or keep editing it through chat. Planning documents are stored as per-drawing project state, and Muse edits only the document text and real photo requests, never spatial geometry. The PDF remains a derived output of the planning document, not the editable source of truth. This decision supersedes [ADR-0006](0006-session-only-planning-output.md).

## Storage and change boundaries

- The project's `planningArtifacts` holds per-drawing documents, the reference drawing/sources, the document revision, real photos and up to 5 previous text revisions. The existing SQLite storage, revision conflict handling and project export are reused.
- The preview is read-only, and users edit section and booth content through the existing Muse chat. Model results are validated against allowed sections and target IDs, and unrelated content is preserved.
- A photo request is not a successful capture. The browser captures the real 3D scene and states which photos are missing. Generated concept images are not shown as real scene captures.
- When the reference drawing or sources change, the document is detected as stale and an explicit refresh is required. The current Studio refresh applies the new reference while clearing photos and previous text history, and keeps the existing body and cost descriptions of booths that still exist for review.
- An estimated participation fee has an amount, currency, basis, included terms and tax status. Prices without a basis are not finalized or treated as a real sale/payment state ([0005](0005-design-studio-scope.md)).

## Output and limits

The user saves a PDF from browser printing. The report escapes user content, waits for embedded images and fonts to be ready, and does not fetch the content of external brand links on its own. Failures or missing images are not dressed up as successful captures. PDF typesetting and page layout rules are in the [UI specification](../../web/design.md).

The 5 previous texts are not a full project audit history or a co-editing feature. Storing drawings and images with planning documents has a storage cost and follows project/API limits. If unlimited document history, co-editing or automatic server PDF distribution becomes necessary, decide the storage, conflict and output structure again.

Evidence: [document schema and change functions](../../web/lib/plans/planning-artifact.ts), [project schema](../../web/lib/projects/schema.ts), [document editing service](../../web/server/plans/planning.ts), [Studio refresh/Undo wiring](../../web/components/studio/studio.tsx), [document panel](../../web/components/studio/planning-artifact-panel.tsx), [report output](../../web/lib/plans/planning-report.ts), [document regression test](../../web/tests/planning-artifact.test.ts). Related history: `18ceb83`, `93c3a19`, `dfa4ceb`.
