# muvilion — drawing studio

The home page is a drawing-first workspace: upload PDF, PNG/JPEG or optional DXF, crop a space, review evidence, calibrate a known distance, edit walls, place objects and inspect 3D. Muse chat uses the Vercel AI SDK; interpretation and layout proposals require explicit Apply.

## Run

```sh
# engine/
uv sync
uv run uvicorn app.main:app --reload
# web/
pnpm install
pnpm dev
```

Set `ENGINE_URL` (default http://localhost:8000) and `MODEL_API_KEY` in gitignored `web/.env.local`. Existing model provider configuration is reused. Extraction/manual editing work without a model key. The studio needs the actual Python engine, not ENGINE_MOCK.

## Pipeline

- PDF: pdfplumber vectors/text + PDFium preview; OpenCV supplements raster content.
- Images: Pillow orientation + OpenCV line candidates. Raster OCR is not implemented.
- DXF: ezdxf ASCII modelspace entities; optional, no PDF-to-DXF conversion. Binary DXF and CAD layer/dimension relationships are not supported.
- `lib/plans/schema.ts`: normalized evidence, confirmed scale and editable objects.
- Muse interprets fixed line IDs using 4×4 spatial regions, padded image crops and batches of up to 250 candidates, with at most three requests in flight. Every selected candidate is assigned once; default minimum length is 12 preview pixels (adjustable 2–24). Shorter evidence is preserved and explicitly reported as deferred. Long new wall candidates (at least 12% of the shorter preview dimension) undergo a second pass against the full-page image to reject floor trenches and grid lines; unchecked or rejected long walls stay unknown. Short room walls retain the regional result, because full-page downscaling obscures their detail. Failures/cancellation retain partial proposals without applying them automatically.
- Derived 3D walls merge collinear overlapping evidence and gaps up to 5 mm after scale confirmation. Conservative parallel pairs infer thickness; source IDs and geometry remain available. Door-size gaps and ambiguous edge triples remain separate. Heights stay provisional.
- Muse also proposes booth/stage/lounge objects; geometry checks report overlap, wall intersections and bounds.
- SVG review + React Three Fiber preview; JSON import/export and browser local storage.
- Trace a simple interior floor polygon in the studio drawing settings after confirming scale. It defines usable floor and ceiling surfaces without inventing walls. Cropping clears scale and floor review.

Extraction no longer truncates at 1,200 lines or 400 text items. The engine explicitly rejects pages over 100,000 lines, 20,000 text items, or its text/entity resource budgets instead of returning partial evidence. All extracted lines start unknown. Scale requires confirmation. 3D uses schematic wall thickness/height; this is a concept editor, not construction-grade reconstruction or an evacuation validator. Crowd simulation, registration queues and the old replay/review APIs have been removed. The Python layout solver, validation rules and walkable-area geometry remain available for future integration.

## Space design and heights

CC0 materials, furniture and lighting candidates with individual download links and adoption notes are listed in [ASSET-SHORTLIST.md](ASSET-SHORTLIST.md). The 12 selected assets are bundled at 1K under `public/assets/cc0/`, with source URLs and hashes in its manifest. Editor selection UI integration is still pending.

Simple view's **Design space** opens three layers: Spaces (non-solid purpose zones), Elements (physical installations), and Height & ceiling. Booths are optional spaces; legacy booth/lounging solid objects remain importable. Zones may be marked available for later company/team assignment, without adding registration workflows.

The same document drives 2D, 3D, Muse and export. Objects have height and optional elevation above floor; ceilings store a level underside height, finish and estimated/confirmed status. Existing wall extrusion height is persisted. Geometry checks cover reviewed floor boundaries, zone containment, vertical overlap, ceiling exceedance and circulation obstruction. A platform-mounted object's elevation is entered relative to the floor.

3D uses Drei CameraControls with Overview, Top, click-to-move Explore, focus selection, and reset. Explore requires reviewed scale, floor containment and headroom. Click the floor to move at eye height, drag to look around, and scroll to zoom. A ring previews valid/blocked destinations. The entire straight route is checked against walls, installations, floor boundaries and headroom, including hidden elements; blocked routes are rejected rather than automatically routed around obstacles. Dragging stops travel. Reduced motion uses an immediate transition after the same route checks. Entering Explore shows the ceiling; leaving restores the overview ceiling setting. The Layers popover offers hidden, solid or transparent ceiling plus independent structure and overhead visibility. These affect rendering only: hidden geometry remains in Muse context and collision checks. A reviewed floor polygon is required to render the ceiling.

Studio controls use shadcn Base UI primitives mapped to Muse semantic colors. Analysis, model information and visibility settings are collapsed by default in Simple view. Camera transitions respect reduced-motion preferences. Third-party component attribution is in `licenses/shadcn-ui-MIT.txt`.

Muse drafts zones and installations with explicit review/Apply, preserving source evidence, scale, floor boundary and ceiling review. This uses live model proposals with deterministic geometry checks; the legacy OR-Tools BoothSpec packing engine is not a general 3D design solver and is not invoked here. Ceiling surfaces are level and objects schematic; sloped roofs, detailed trusses, lighting simulation and structural/rigging verification are not implemented.

## Local real drawings

Place local PDFs under root `DemoData/` or set `DEMO_DATA_DIR`:

- `san-jose-mcenery-floor-plan-and-specs.pdf`: Facebook F8 venue brochure; useful context, not detailed architectural geometry.
- `coex-hall-a-2024.pdf`: official COEX Hall A dimensioned plan, available from [COEX floor plans](https://business.coex.co.kr/exhibition-hall/coex-lease-info/floor-plan/).
- `fort-mason-ground-floor.pdf`: ground-floor crop of the official Festival Pavilion dimensions sheet. `engine/scripts/prepare_fort_mason.py` prepares the local asset. Adjacent source metadata records crop coordinates and manually checked dimension references.
- `fort-mason-reviewed-plan.json`: saved live Muse recognition with separately reviewed scale and floor outline; accessible from the example selector. Raw model results and the evaluation report are kept alongside it. This local artifact is required for the saved 3D view; uploading the PDF starts a fresh review.
- `fort-mason-spatial-design-plan.json`: actual Muse-generated booth-free concept with 3 zones and 10 installations, available as **Fort Mason · space design demo**. Its level 6 m ceiling and wall extrusion are estimated design assumptions, not surveyed dimensions. The adjacent report records evaluation and limitations.

PDFs are local evaluation assets, not bundled or committed. Source metadata lives alongside them. The UI reports missing files rather than supplying a synthetic substitute.

## Checks

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Engine checks: `uv run pytest`, `uv run ruff check .`. Regenerate engine OpenAPI types with `pnpm gen:engine-types` after contract changes.

### Meta / Muse exhibition concept

Choose **Meta / Muse · exhibition concept** for the curated Fort Mason demo: 76 installations across keynote seating, AI demo stations, a lounge and circulation. Original procedural graphics reference the official sources in `fixtures/meta-muse-sources.json`; no third-party photos are redistributed. This is an independent concept, not a reconstruction of a Meta event.

Regenerate local DemoData from the reviewed floor plan with `node --import tsx scripts/build-meta-showcase.mts /absolute/path/to/DemoData` from web. The generator checks the plan schema and design warnings before writing. The optional `visualStyle` and per-object `appearance` preserve old imports and keep the same bounds for selection, editing and collision checks; furniture collision remains conservative bounding boxes. Ceiling height remains an estimated 6 m, lighting is illustrative, and venue reconstruction uncertainty remains unchanged.

## Project sources

The header Sources button opens a separate material manager storing concept images (PNG/JPG/WebP), brand URL bookmarks with notes, and planning documents (PDF/TXT/Markdown). The current drawing is a separate active source. New references default to unselected; toggles control references included in the next Muse discussion or design draft. Workspace geometry remains available as a spatial constraint. Drawing analysis explicitly reviews the active drawing. URL bodies are not fetched.

Images are resized locally. Planning PDFs are rendered and text-extracted through the existing Python extraction service, with every page included (up to 12 pages, 20 MB per upload). Scanned PDFs provide page images even when no text is extractable. DOCX/PPTX are not supported; export these to PDF first. The library permits 12 references and a 10 MB serialized content budget.

Sources and selection state are saved in browser IndexedDB for this local workspace; replacing the active drawing retains the library. Export project downloads a versioned JSON envelope with the plan, source previews/text/notes and selection state. Import project restores it, including source-only projects. Legacy plan JSON remains importable. Original binary files are not archived; keep originals separately. Browser storage is local, not a server backup.

The centre workspace offers 2D editing with an optional original-drawing overlay and 3D space. Source previews open independently from the workspace. Muse does not apply source-driven changes until the existing proposal review/Apply step. Changing sources invalidates an outstanding proposal.

## Venue overview

The default 3D cutaway caps source-wall display at 1.1 m to reveal the interior while retaining every classified wall segment and real gap. Switch off cutaway or enter Explore to see full wall heights. Stored geometry and navigation checks always retain physical dimensions. Existing walls are neutral grey; planned partitions are blue with a dark top edge. Selected AI-authored partitions are labelled as AI proposals; older objects with no recorded provenance are only labelled planned partitions.

Use **입구 표시** in 2D to place an entrance marker, then edit its name or direction in Design space. Markers persist in exports and appear in both views and Muse context. These are user annotations, not automatically verified doors; they do not cut openings in wall geometry. No source gaps are automatically filled or wall lines discarded for presentation.

### 2D presentation principle

The default 2D editor is a human-readable space diagram, not a technical drawing viewer: retain essential walls, entrances, zones and object footprints; use a muted floor and furniture symbols; show labels only where they fit or on selection. Source linework, dimensions and images are available through Original drawing, and appear during geometry-review tools. An unclassified plan falls back to its source instead of pretending to have a reconstructed structure. Schematic presentation never changes geometry, wall openings, object IDs, coordinates or validation inputs.

## External exhibitor booths

Open **외부 참가 부스** from the studio header. Without a drawing, **참가 부스 예시로 시작**
loads an original schematic 18 × 12 m example with four booths; it requires no external
venue files and is neither a measured venue nor model-generated output.

Organizers select assignable zones, set their position/dimensions, participation fee in
KRW, maximum installation height and included services, then publish a participant URL.
Publishing snapshots the space. Overlapping booths, circulation obstructions and
existing geometry conflicts are rejected. Applicants submit company/contact details
and a brief. Their fee quote is retained even if the listing price changes later.
Only one application per booth may be approved.

Applicants keep a private fragment-based resume URL. Approval opens an isolated booth
workspace with 2D/3D preview, manual installation editing, and Muse proposals. Muse's
coordinator delegates to a fresh booth specialist, which calls geometry validation,
reads repair feedback and submits only a checked proposal (at most six specialist steps,
110-second overall deadline). It receives only its booth, company, brief and current
booth objects. Applying a proposal and saving/submitting it are explicit user actions.
Organizers can review a submitted design and import its transformed objects into the
venue after a fresh geometry check. Exported dimensions, quantities and notes are
construction-discussion concepts, not certified plans or quotations.

Requires Node >=22.13. SQLite persists application state on one application host at
`.data/booths.sqlite`, configurable with `BOOTH_DB_PATH`. Use persistent disk and backups;
an ephemeral or multi-host deployment needs an appropriate shared storage adapter.
Only hashes of organizer/applicant capability tokens are stored server-side. Public
catalogues omit contact details and the source drawing. The organizer recovery code
and applicant resume URL grant access: keep them private. This concept does not add
account login, email delivery or payment processing. To accept actual external users,
serve the application at an externally reachable HTTPS origin; localhost links only
work on the local machine.

## Server code

`app/api` owns HTTP parsing, status codes, and streaming responses. `server/agent` owns
model configuration; `server/plans` executes drawing workflows; `server/engine` is the
single Python transport (including multipart extraction); `server/examples` loads local
example assets. Runtime entry points import `server-only`. Shared schemas and pure
transformations stay in `lib/`.

Examples are optional local files. Set `DEMO_DATA_DIR` to an explicit directory (especially
in a worktree or packaged install); the default is `../DemoData` relative to the web
working directory. Missing examples return 404 and users can upload their own drawings.

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

Only app-level credentials are persisted in SQLite so far; project persistence remains
separate from this settings feature.
