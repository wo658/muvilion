---
status: accepted
recorded: 2026-11-02
---
# Remove the Python service and handle the work with Next.js and Meta Model

Current change: per [ADR-0012](0012-muse-scale-floor-auto-design.md), Muse measures scale bars and dimensions to finalize the scale and traces the floor outline.

At the user's request to remove Python, document preparation moves to Next.js and FastAPI and the engine transport contract are removed. This supersedes ADR-0001's service boundary and ADR-0003's decision to make the Python contract the source of truth. It resolves the document service dependency left over from ADR-0010. In place of the engine line fallback in [ADR-0008](0008-muse-pdf-wall-tracing.md), Muse reading is retried once, and if it still fails an error is shown. Ownership of original assets, user Apply and SQLite is kept.

PDF.js and the existing Sharp are used only to turn original pages into images; interpretation of walls, text and dimensions is left to Meta Model. Uploads and samples use the same path. PDF reference sources attach page images directly to the model context. Without a key, the preview is marked as uninterpreted, and model failures are not replaced with local extraction results. Existing web data and geometry checks are kept.

Document rendering runs in a request-scoped Node worker with limits on file size, page count, image size and time. The worker is terminated on cancellation. This is not a separate server or a durable job system. The user also decided to drop new DXF support. New drawings accept only PDF, PNG and JPG, and CAD users are directed to export to PDF. No DXF conversion library is added. Originals, saved previews and edit results of existing DXF drawings are preserved for contract compatibility. PDF coordinates are relative to the visible crop with rotation applied.

`web/lib/plans/schema.ts` is the source of truth for the drawing contract. Old extraction provenance remains readable for compatibility with existing projects, but new files are recorded as `preview`/`muse`. The Python/OpenAPI generation steps, environment configuration, Docker service and test runtime are removed. Standalone Python scripts for video production are not app runtime dependencies.

## Reasons

What is being removed is less the Python server itself than the local ML/CV computation inside it. OpenCV line detection, PDF vector line and text extraction, the OR-Tools layout solver and Shapely geometry validation are taken out of the app, and drawing interpretation is handled in one place, Meta Model. This concentrates the places to improve interpretation quality into the prompts and the code that applies Muse results, and removes the need to maintain different local algorithms per format.

For the same reason, PNG, JPG and PDF drawings are handled through one path: Node worker preview → Muse wall and text reading. On main just before the removal, Muse tracing applied only to PDFs. In a 2026-11-02 comparison on the same Loft39 floor plan, a PNG upload produced 572 OpenCV line candidates (including furniture lines, 0 text items), while wrapping the same image in a PDF produced 40 Muse walls. After the removal, the PNG original read directly gave 33 Muse walls and 15 text items. The file format a user uploads should not change result quality.

If document format fidelity or precise CAD annotation support becomes a product requirement, revisit the renderer. When physical simulation or validated optimal solutions become necessary, define separate requirements and validation, and do not describe current results that way.
