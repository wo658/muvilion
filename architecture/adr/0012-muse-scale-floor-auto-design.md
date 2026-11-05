---
status: accepted
recorded: 2026-11-02
---
# Muse sets the scale and floor outline and auto-applies the first interior

Current change: per [ADR-0013](0013-atomic-muse-operations.md), all design is committed immediately per operation, so the first automatic design is no exception. The auto-run conditions and the run-once rule are kept.

At the user's request, finalizing the scale during drawing preparation moves from the user to Muse, and a new project with brand sources is completed with its interior furnished when first opened. This is an exception to [ADR-0011](0011-nextjs-document-preparation.md)'s "scale is left unconfirmed" and [ADR-0004](0004-reviewed-design-proposals.md)'s "spatial changes are applied only through user Apply".

## Scale and floor outline

- Scale evidence is received in the wall tracing call as described in the scale evidence section of [ADR-0008](0008-muse-pdf-wall-tracing.md), and short references are enlarged and their ticks re-read. This decision changes only who finalizes that result.
- When the evidence is a printed scale bar or dimension line and is **cross-checked**, Muse finalizes it (`scaleConfirmed: true`, `scaleSource: "muse"`, `scaleEvidence`). Cross-checked means either (a) tick fitting succeeded on the enlarged crop (`refined`, set only by code; a value sent by the model is cleared by the server), or (b) two or more independent length references agree within 5%. A single unchecked reading stays an estimate, because one misreading would silently finalize a wrong scale. The screen shows "Measured by Muse" and the evidence, and if the user measures again it changes to `scaleSource: "user"`. Area labels, booth module assumptions and conflicting evidence stay estimates for the user to finalize. Confirmations without a source in existing documents are read as user confirmations.
- The floor outline comes from a separate Muse call that runs in parallel with wall tracing, and only polygons without self-intersections are used. Already reviewed outlines or user scales are not overwritten. On failure, the user draws it.
- This was decided by comparing two approaches. If only the user finalizes (ADR-0008's original decision), the mandatory scale step makes every drawing wait for user input and the first automatic design cannot happen. If Muse finalizes unconditionally, a single misreading stays as is. So evidence collection and tick fitting use the ADR-0008 implementation as the source of truth, and only finalization is left to Muse under the cross-check condition. This branch's separate scale measurement call (enlarged grid re-reading, Moscone West L3 error −0.5 to +0.8%) was redundant and removed; only the floor outline call remains. The Seongsu pop-up sample was finalized with −0.5% error because 4 dimension lines agreed.

## Auto-applying the first interior

- When a sample project is created with a selected brand URL or reference images, `autoDesignPending` is set. Empty projects started from an upload have no sources at creation, so it is not set.
- When the active drawing has a scale and floor outline and the design is empty, Studio runs a full-floor furniture layout interior design once and applies the result without a proposal step. The flag is cleared at start so it does not run again after a reload or failure.
- Samples with a recorded result (added 2026-11-04) install that result as a new project by default, so automatic design does not run. Live design takes several minutes and sometimes still does not finish within 600 seconds, so the demo showed a different, unfinished result each time. The recording stores the result of a real Muse run (design and planning document) and is marked as a recording on screen and with `recordedDemo`. Choosing "Design from scratch with Muse" runs this decision's automatic design as is.
- The design itself uses the existing Designer Muse path, so it goes through geometry, circulation and seating checks and visual self-review. Application is committed per operation as in [ADR-0013](0013-atomic-muse-operations.md).

## Revisit conditions

If scale errors cause real problems in design or quotes, or automatic application often conflicts with user intent, return to a user confirmation step.

Evidence: [finalization rule `scaleIsMeasured`](../../web/lib/plans/trace.ts), [re-reading flag](../../web/server/plans/trace.ts), [floor outline call](../../web/server/plans/floor.ts), [auto design start](../../web/components/studio/studio-chat.tsx), [regression test](../../web/tests/muse-scale-floor.test.ts).
