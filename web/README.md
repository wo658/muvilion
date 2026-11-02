# muvilion — drawing studio

Architecture: [overview](../architecture/README.md) · [ADRs](../architecture/adr/README.md).

The home page is a drawing-first workspace: upload PDF or PNG/JPEG, crop a space, review evidence, calibrate a known distance, edit walls, place objects and inspect 3D. Muse chat uses the Vercel AI SDK; interpretation and layout proposals require explicit Apply.

## Run

```sh
# web/
pnpm install
pnpm dev
```

Set `MODEL_API_KEY` in gitignored `web/.env.local`, or enter a Meta API key in Settings.
Node.js 24+ is the only application runtime. Without a model key, imports show the source
preview with an explicit warning and no inferred walls/text; manual calibration/editing remains available.

## Pipeline

- PDF: PDF.js 6.5.438 renders the visible crop with its page rotation, using the bundled Node canvas implementation. No vector-line or text extraction runs.
- Images: existing Sharp applies EXIF orientation, composites transparency onto paper, and bounds image size.
- New DXF uploads are unsupported. Export CAD drawings to PDF first. Existing DXF projects retain their saved previews, edits and original files; no DXF renderer is installed.
- Meta Model reads the prepared image for walls, visible text and provisional dimensions. Uploads and samples use the same workflow. Failed model reading returns an error, never a local-extraction fallback.
- Reference PDFs are supplied to Muse as page images; `text` stays empty until the model reads them in conversation. TXT/Markdown references keep their literal text.

- `lib/plans/schema.ts`: normalized evidence, confirmed scale and editable objects.
- Muse interprets fixed line IDs using 4×4 spatial regions, padded image crops and batches of up to 250 candidates, with at most three requests in flight. Every selected candidate is assigned once; default minimum length is 12 preview pixels (adjustable 2–24). Shorter evidence is preserved and explicitly reported as deferred. Long new wall candidates (at least 12% of the shorter preview dimension) undergo a second pass against the full-page image to reject floor trenches and grid lines; unchecked or rejected long walls stay unknown. Short room walls retain the regional result, because full-page downscaling obscures their detail. Failures/cancellation retain partial proposals without applying them automatically.
- Derived 3D walls merge collinear overlapping evidence and gaps up to 5 mm after scale confirmation. Conservative parallel pairs infer thickness; source IDs and geometry remain available. Door-size gaps and ambiguous edge triples remain separate. Heights stay provisional.
- Muse also proposes booth/stage/lounge objects; geometry checks report overlap, wall intersections and bounds.
- SVG review + React Three Fiber preview; JSON import/export and local SQLite projects.
- Trace a simple interior floor polygon in the studio drawing settings after confirming scale. It defines usable floor and ceiling surfaces without inventing walls. Cropping clears scale and floor review.

Document uploads are limited to 20 MB; raster inputs to 30 megapixels; previews to 2400 pixels on their longest side. Reference PDFs support up to 12 pages and a 24 MB preview budget. Rendering runs in a disposable Node worker with a 60-second timeout and cancellation. Scale always requires user confirmation. Existing project methods (`pdf-vector`, `opencv`, `dxf`) remain read-compatible; new documents use `preview` or `muse`.

Python/FastAPI, OR-Tools, Shapely, layout/validation endpoints, walkable-area calculation, caches, mocks and generated engine contracts are removed. Existing web geometry and data checks remain; proposals are not measured circulation simulations or safety certification.

## Space design and heights

CC0 materials, furniture and lighting with individual download links and adoption notes are listed in [ASSET-SHORTLIST.md](ASSET-SHORTLIST.md). The 12 assets are bundled at 1K under `public/assets/cc0/`, with source URLs and hashes in its manifest.

Muse can call the read-only `search_design_assets` tool in chat and space design generation. Booth proposals retain their bounds, height, collision validation and user approval steps. Drafting can query the local catalog, review a candidate, then submit a proposal with optional `modelAssetId` or `materialAssetId` on each installation. The review panel names its selected assets; only **변경 적용** applies them. IDs survive project export/import and local persistence. Unknown IDs, mismatched furniture/light kinds and model-plus-material combinations are rejected. Old plans without asset IDs retain their schematic/exhibition appearance.

After Apply, 3D lazily loads bundled glTFs or PBR maps. Models retain their authored materials and use catalog dimensions; mismatched installation dimensions produce a schematic fallback. Catalog bounds are file measurements, not surveyed product dimensions. Each instance has an isolated transform and skeleton with shared cached geometry/textures. A failed asset shows a labelled schematic fallback rather than losing the workspace. Materials currently cover schematic installation surfaces such as partitions, not the existing floor/walls/ceiling. Light models remain visual fixtures, not a calibrated lighting simulation. Try “다운로드한 의자와 테이블로 라운지를 만들고 목재 가벽과 펜던트 조명을 배치해줘”.

Muse proposes non-solid purpose zones and physical installations through conversation and explicit Apply. Drawing settings hold scale, floor and height controls. Booths are optional spaces; legacy booth/lounge objects remain importable. Assignable zones describe planned use without enabling registration workflows.

The same document drives 2D, 3D, Muse and export. Objects have height and optional elevation above floor; ceilings store a level underside height, finish and estimated/confirmed status. Existing wall extrusion height is persisted. Geometry checks cover reviewed floor boundaries, zone containment, vertical overlap, ceiling exceedance and circulation obstruction. A platform-mounted object's elevation is entered relative to the floor.

3D uses Drei CameraControls with Overview, Top, and click-to-move Explore. Explore requires reviewed scale, floor containment and headroom. Click the floor to move at eye height, drag to look around, and scroll to zoom. A ring previews valid/blocked destinations. The entire straight route is checked against walls, installations, floor boundaries and headroom, including hidden elements; blocked routes are rejected rather than automatically routed around obstacles. Dragging stops travel. Reduced motion uses an immediate transition after the same route checks. Entering Explore shows the ceiling; leaving restores the overview ceiling setting. View settings offer hidden, solid or transparent ceiling plus independent structure and overhead visibility. These affect rendering only: hidden geometry remains in Muse context and collision checks. A reviewed floor polygon is required to render the ceiling.

Studio controls use shadcn Base UI primitives mapped to Muse semantic colors. Analysis, model information and visibility settings are collapsed by default in Simple view. Camera transitions respect reduced-motion preferences. Third-party component attribution is in `licenses/shadcn-ui-MIT.txt`.

Muse drafts zones and installations with explicit review/Apply, preserving source evidence, scale, floor boundary and ceiling review. This uses live model proposals with deterministic geometry checks; the legacy OR-Tools BoothSpec packing engine has been removed. Ceiling surfaces are level and objects schematic; sloped roofs, detailed trusses, lighting simulation and structural/rigging verification are not implemented.

## Starting a project

With no projects (or a link to a project that no longer exists), the app opens a start screen:
start from your own drawing, a sample drawing, or an empty project. Sample drawings are listed in
`data/samples/samples.json` (sources and redistribution notes in `data/samples/README.md`); choosing
one copies it into SQLite as a new project. Drawings are stored as the project's original and
prepared and read by Muse when the project opens. Set `SAMPLES_DIR` to read
samples from another directory.

## Checks

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

`lib/plans/schema.ts` is the document contract. There is no engine API or generated OpenAPI step.

## Project sources

Project settings open the Sources manager for concept images (PNG/JPG/WebP), brand URL bookmarks with notes, and planning documents (PDF/TXT/Markdown). The active drawing and every attached reference are included in Muse context; legacy selection flags no longer exclude attached references. Workspace geometry remains a spatial constraint. Drawing analysis reviews the active drawing. URL bodies are not fetched.

Images are resized locally. Planning PDFs are rendered in Next.js and attached as page images for Muse to read, with every page included (up to 12 pages, 20 MB per upload). No local text extraction or OCR runs. DOCX/PPTX are not supported; export these to PDF first. The library permits 12 references and a 10 MB serialized content budget.

SQLite is the authoritative store for named projects, drawing geometry and edits, source previews/text/notes, and per-drawing planning documents. Original uploaded drawings and references are stored as BLOBs alongside preview images in the same database. Replacing a drawing retains the project's reference library. The toolbar creates, names and switches projects; edits autosave with revision checks to prevent another tab's changes from being silently overwritten. Failed saves retain the editor state and offer retry or export.

Existing localStorage drawings and IndexedDB sources are imported together as a recovered project when opening the app from the same browser origin. Legacy entries are removed only after SQLite has accepted the project. Original files were not stored by the old app, so migration recovers its saved previews and extracted data, not unavailable original bytes. New uploads retain their originals.

Export project downloads a version 2 JSON bundle containing the drawing, references and original files; API keys are excluded. Import creates a separate project. Version 1 project bundles and legacy drawing JSON remain importable. Source-only projects are supported. Browser storage is used only to read and clear legacy data; new project saves go through the local server to SQLite. Muse conversation/run history is not persisted by this project-storage feature.

The centre workspace defaults to 3D; drawing setup tools provide 2D evidence review and editing. Source previews open independently from the workspace. Muse does not apply source-driven changes until the existing proposal review/Apply step. Changing sources invalidates an outstanding proposal.

## Venue overview

The default 3D cutaway caps source-wall display at 1.1 m to reveal the interior while retaining every classified wall segment and real gap. Switch off cutaway or enter Explore to see full wall heights. Stored geometry and navigation checks always retain physical dimensions. Existing walls are neutral grey; planned partitions use their saved design colors. Selected AI-authored partitions are labelled as AI proposals; older objects with no recorded provenance are only labelled planned partitions.

Entrance markers are editable drawing annotations. Markers persist in exports and appear in both views and Muse context. These are user annotations, not automatically verified doors; they do not cut openings in wall geometry. No source gaps are automatically filled or wall lines discarded for presentation.

### 2D presentation principle

The default 2D editor is a human-readable space diagram, not a technical drawing viewer: retain essential walls, entrances, zones and object footprints; use a muted floor and furniture symbols; show labels only where they fit or on selection. Source linework, dimensions and images are available through Original drawing, and appear during geometry-review tools. An unclassified plan falls back to its source instead of pretending to have a reconstructed structure. Schematic presentation never changes geometry, wall openings, object IDs, coordinates or validation inputs.

## Current product scope

The studio has one workflow: drawing and brand sources → 3D spatial design → scene
captures and a PDF planning document. Booths may still be designed as spatial
installations, but organizer/participant modes, booth sales, applications, approval
and participant-only design are deferred to a future platform plan.

The former participation pages redirect to the studio. Former `/api/booths` endpoints
return `410 PLATFORM_DEFERRED` and do not read or modify legacy booth data or invoke
models. Existing `.data/booths.sqlite` files (or a previously configured `BOOTH_DB_PATH`)
are left untouched for archival recovery; the current application does not open them.
Do not publish those files: they can contain contact details and private project data.
Ordinary drawing projects and their source assets remain in the existing project store.

## Server code

`app/api` owns HTTP parsing, status codes, and streaming responses. `server/agent` owns
model configuration; `server/plans` executes drawing workflows and prepares source previews; `server/projects` stores projects
and creates sample projects. Runtime entry points import `server-only`. Shared schemas and pure
transformations stay in `lib/`.

### Chat controls

Muse uses the current [AI Elements Prompt Input](https://ui.shadcn.com/docs/ai-elements/base/prompt-input) composition: shadcn Base UI Input Group with a textarea and action addon, and standard Buttons for suggestions and review actions. Source management remains the existing Sources workflow. Send becomes Stop during an active AI SDK response; source preparation disables Send until the request can start. Enter sends, Shift+Enter inserts a newline, and IME composition does not submit.

Input Group was added from the official `base-nova` registry with the shadcn CLI on 2026-10-28. Its MIT license was verified against [shadcn-ui/ui LICENSE.md](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md); the existing notice in `licenses/shadcn-ui-MIT.txt` covers this component. Existing Button, Input and Textarea customizations are preserved.

## Local Meta API key

Requires Node.js 24 or newer for built-in SQLite. Open **Settings** from Studio to
save a Meta API key or import the server's `MODEL_API_KEY` (loaded by Next.js from
`.env.local` or the launch environment). A stored key selects Meta and takes precedence
over environment provider settings. Remove it to restore the environment configuration.
Changes apply to the next model request; saving does not make a paid validation call.

The server stores the key, unencrypted, in `web/data/app.sqlite` with owner-only file
permissions on Unix. Set `MUVILION_DATA_DIR` to use a different local data directory.
Keys never appear in status responses, browser storage or project exports. Do not share
the data directory or commit it. Settings endpoints accept only loopback hosts and reject
cross-origin browser requests. This is a local, single-user app, not a hosted account system.

Projects, assets and app-level credentials share this database. `server/database.ts` owns
the connection and schema; `server/projects` owns transactional project persistence.
Project endpoints use the same local-only request guard as settings. To copy the complete
database, stop the app first; use project export when sharing a project without credentials.

## Unified message routing

The composer sends the message, recent conversation, selected item, and a compact drawing
summary to `/api/plans/intent`. `server/plans/intent.ts` uses the configured model to choose
chat, design, interpretation, photography, planning-document editing, or clarification. The browser dispatches the existing
workflow; regional analysis/cropping continues to run in the browser. Design requests
use the shared Designer Muse tool loop. Intent classification itself selects one workflow
and does not create a background job. Each ordinary message adds one classification model call.

The intent layer checks drawing availability, confirmed scale for design, and unknown
lines for interpretation. Invalid/failed classification never defaults to a mutation.
Design/analysis still require explicit Apply, and stale proposals cannot be applied.
The existing analysis shortcut remains available; the main Send action routes automatically.
Meta supports `toolChoice: "auto"`; routing accepts exactly one validated tool result.

The managed Compose environment uses `APP_ORIGIN=http://web.redpact.test:3000` for its declared browser hostname. Outside loopback, project/settings storage accepts only this explicitly configured origin and still rejects cross-origin and cross-site browser requests. Leave `APP_ORIGIN` unset for ordinary localhost development; it is a trusted local deployment setting, not authentication for public hosting.

## Planning document Artifact

Open **Planning document** in the drawing workspace to create a persistent document with Muse. The read-only preview stays beside the existing conversation: select **Ask Muse about this** on a section or booth, then describe the change. There are no manual document fields. For example: “Set A1 participation fee to KRW 1,500,000 excluding tax, including counter and signage; leave A2 unchanged.” Document requests update text and images only; spatial edits retain their Apply workflow.

Documents are stored per drawing in the existing SQLite project, including real scene photos and five prior text revisions. Project export/import includes them. Use the project save indicator to check autosave; closing the panel does not discard it. A changed drawing or reference library requires explicit **Refresh dimensions & references**, which clears old images and text history while retaining prose/fees for review. **Undo document revision** restores prior text within the same source snapshot.

The participation guide lists explicit booth/assignable zones and standalone booth objects, their drawing dimensions, planned circulation, and estimated participation fees with currency, basis, inclusions and tax status. Unknown prices remain unpriced unless the user supplies a basis or requests an estimate. This does not enable registration, payments or applications. Automatic photos use the real 3D renderer; review framing and retry missing shots through Muse. **Open planning PDF** exports the document through the browser print dialog; the project document remains the editable source.
