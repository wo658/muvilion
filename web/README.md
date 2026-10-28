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
- Trace a simple interior floor polygon in Details after confirming scale. The 3D Walk inside mode uses a 1.65 m eye height, WASD/arrows, drag to look, reset and Escape to return to the overview. Movement collides with derived walls, placed objects and the reviewed floor boundary. Unrecognized walls remain open; the outline never creates invented walls. Cropping clears both scale and floor review.

Extraction no longer truncates at 1,200 lines or 400 text items. The engine explicitly rejects pages over 100,000 lines, 20,000 text items, or its text/entity resource budgets instead of returning partial evidence. All extracted lines start unknown. Scale requires confirmation. 3D uses schematic wall thickness/height; this is a concept editor, not construction-grade reconstruction or an evacuation validator. Legacy simulation modules remain in the repository but are not the studio workflow.

## Space design and heights

Simple view's **Design space** opens three layers: Spaces (non-solid purpose zones), Elements (physical installations), and Height & ceiling. Booths are optional spaces; legacy booth/lounging solid objects remain importable. Zones may be marked available for later company/team assignment, without adding registration workflows.

The same document drives 2D, 3D, Muse and export. Objects have height and optional elevation above floor; ceilings store a level underside height, finish and estimated/confirmed status. Existing wall extrusion height is persisted. Geometry checks cover reviewed floor boundaries, zone containment, vertical overlap, ceiling exceedance and circulation obstruction. A platform-mounted object's elevation is entered relative to the floor. Walkthrough body clearance is 1.8 m.

3D has independent ceiling, beam/structure and overhead-element visibility toggles. These only affect rendering: hidden geometry remains in Muse context and collision checks. The ceiling defaults off in overview and on in walkthrough until explicitly toggled. A reviewed floor polygon is required to render the ceiling.

Muse drafts zones and installations with explicit review/Apply, preserving source evidence, scale, floor boundary and ceiling review. This uses live model proposals with deterministic geometry checks; the legacy OR-Tools BoothSpec packing engine is not a general 3D design solver and is not invoked here. Ceiling surfaces are level and objects schematic; sloped roofs, detailed trusses, lighting simulation and structural/rigging verification are not implemented.

## Local real drawings

Place local PDFs under root `DemoData/` or set `DEMO_DATA_DIR`:

- `san-jose-mcenery-floor-plan-and-specs.pdf`: Facebook F8 venue brochure; useful context, not detailed architectural geometry.
- `coex-hall-a-2024.pdf`: official COEX Hall A dimensioned plan, available from [COEX floor plans](https://business.coex.co.kr/exhibition-hall/coex-lease-info/floor-plan/).
- `fort-mason-ground-floor.pdf`: ground-floor crop of the official Festival Pavilion dimensions sheet. `engine/scripts/prepare_fort_mason.py` prepares the local asset. Adjacent source metadata records crop coordinates and manually checked dimension references.
- `fort-mason-reviewed-plan.json`: saved live Muse recognition with separately reviewed scale and floor outline; accessible from the example selector. Raw model results and the evaluation report are kept alongside it. This local artifact is required for the saved walkthrough; uploading the PDF starts a fresh review.
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
