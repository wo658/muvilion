---
status: accepted
recorded: 2026-11-02
---
# Muse finds drawing walls and scale evidence in page images

Current change: [ADR-0011](0011-nextjs-document-preparation.md) removed Python extraction, so all uploads and samples use Muse reading. Engine raster re-extraction and the engine line fallback are gone; after one retry, a failure shows an error. For real-world size, the [Scale evidence](#scale-evidence) section below is current behavior; the text before it is the record of the decision at the time. Who finalizes the scale follows [ADR-0012](0012-muse-scale-floor-auto-design.md).

The current goal is a fast demo-level 3D concept, not surveyed reproduction. Instead of users classifying unclassified engine-extracted lines one by one, for user-uploaded PDFs the engine renders the page and Muse looks at the image and text positions to propose wall segments directly. This decision is an uploaded-PDF exception to the "extracted lines start unclassified" principle of [ADR-0003](0003-evidence-and-spatial-contracts.md). Images, DXF and sample projects keep the existing engine extraction.

## Consequences and constraints

- Muse lines are marked `origin: "ai"`, `kind: "wall"`, `method: "muse"` and carry an approximation warning. They are not confirmed building structure or surveyed dimensions.
- The width and depth in meters estimated by Muse are left as `scaleConfirmed: false`. Users still confirm the scale.
- PDFs rejected by the engine for having too many lines (413) are re-extracted in raster mode. The Muse call is retried once within budget, and on failure falls back to engine lines with a warning. The failure reason is written to the server log.
- Next.js owns model calls ([ADR-0001](0001-service-boundaries.md)). Python only renders and extracts and does not call models.
- If coordinate accuracy becomes necessary, decide again whether to snap Muse lines to engine-extracted lines or return to the unclassified line review flow.

## Scale evidence

To produce real-world size, Muse returns the location and value of the scale evidence printed on the drawing along with the walls, and code computes the meters. In the same experiment, asking Muse to answer in meters directly made it estimate the full image pixel size differently each time, with an average error of 13% and a maximum of 41%.

- Evidence is used in order of reliability: scale bars and dimension lines (Moscone, KINTEX) → area labels (hall ft² in the LVCC brochure) → a standard booth size assumption. Within the same tier, longer evidence is preferred, and a warning is raised when sources disagree by more than 15%. The warning records which evidence was used.
- Length evidence shorter than 30% of the page width (most scale bars) is re-read by Muse from a cropped, enlarged image of its surroundings. Muse marks every visible tick, and code fits a straight line to reduce the effect of a single mis-marked point. In 2026-11-02 measurements, the first reading was up to +42% off the reference; after enlarging and tick fitting, the KINTEX dimension line was within 1% and the Moscone scale bar was ±3–11% depending on the run.
- The computed width and depth in meters are also left as `scaleConfirmed: false`. Without evidence they are left empty and user input is requested.
- Sample projects read drawings 4 at a time concurrently. These are live Muse calls, not recorded playback.

Evidence: [extraction and tracing service](../../web/server/plans/extract.ts), [Muse tracing call](../../web/server/plans/trace.ts), [applying trace results](../../web/lib/plans/trace.ts), [regression test](../../web/tests/plan-trace.test.ts). Related history: `3c5258e`, `fdd9693`.
