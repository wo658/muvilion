# muvilion

**Turn a floor drawing and a brief into a furnished 3D event space and a PDF planning document, with Meta's Muse models doing the reading, designing and photographing.**

Event and pop-up planners start from the same inputs: a venue drawing, a brief and some brand references. Getting from that to a layout that a client can walk through and sign off usually takes days of CAD work, renders and slide decks. muvilion compresses that into one workspace. You upload the drawing and references, Muse proposes the space, you review and edit it in 3D, and the app writes a print-ready planning PDF from what is actually on the floor.

Built for the Meta Global AI Developer Hackathon (Oct 27 – Nov 4, 2026). All code in this repository was written during the event; the first commit is dated Oct 27.

## How it works

```
 drawing (PDF/PNG/JPG) ─┐
 brief, brand URLs,     ├─► 1. Read  ─► 2. Design ─► 3. Review ─► 4. Photograph ─► 5. Plan
 concept images ────────┘     Muse       Muse         you          Muse              Muse → PDF
```

1. **Read the drawing.** Next.js renders a bounded preview of the uploaded drawing in a disposable worker. Muse Spark reads the image for walls, openings, labels and printed dimensions. Nothing is applied automatically. You confirm the scale against a known distance and trace the usable floor. There is no local OCR or vector extraction: the model reads the image, and you confirm the geometry.
2. **Design the space.** In chat, Muse works through a set of design tools against the live drawing document:
   - `set_design_brief` records the goal, audience and visitor journey.
   - `search_design_assets` finds bundled CC0 furniture, lighting and materials.
   - `generate_design_concept` uses Muse Image to create a concept image for a feature.
   - `edit_design` places zones, partitions, furniture and wall graphics in metres.
   - `review_design` checks the result against the drawing.
   - `submit_design` hands the proposal to you.

   Every proposal passes deterministic geometry checks before you see it. These cover floor bounds, wall intersections, overlaps, ceiling height and blocked aisles.
3. **Review and apply.** Changes appear as a proposal with a diff. Only **Apply** writes them to the project. The same document drives the 2D plan, the 3D view, Muse's context and the exports. You can keep talking to Muse ("face the LED wall toward the audience", "add a welcome arch") or edit objects by hand.
4. **Photograph it.** Muvi, the photographer agent, plans eye-level shots of named areas. The app renders candidates in the real 3D scene with walls and ceiling. Muse reviews the actual images and either selects one, asks for a camera correction, or rejects the shot. It never falls back to an aerial view to hide a problem.
5. **Write the planning document.** Muse drafts the area-by-area copy and the review items from the applied design, the brief and the captures. The app lays this out as an A4 PDF. Dimensions and quantities come from the drawing data, and cost lines start as editable estimates.

The 3D view has Overview, Top and **Explore**. In Explore you click the floor to walk at eye height under the ceiling. Every move is checked against walls, objects and headroom.

## Meta models

| Model | Used for |
| --- | --- |
| **Muse Spark** (`muse-spark-1.3`, via the Meta Model API) | Drawing reading, design tool calls, chat edits, photo planning and image review, planning-document writing |
| **Muse Image** (`muse-image-1.0`) | Concept images for features and installations, generated inside the design loop |
| Muse Spark open weights (optional) | Same workflows through an OpenAI-compatible endpoint (`MODEL_PROVIDER=baseten`) |

## Try it

Requires Node.js 24+ and pnpm.

```bash
cd web
pnpm install
pnpm dev
```

Open http://localhost:3000 and pick a sample. To run Muse live, either put `MODEL_API_KEY` in `web/.env.local` or paste a Meta API key in **Settings**. The key stays on your machine and is never included in exports.

Two samples are included (`data/samples/`). Both are fictional, independently authored scenarios, not official Meta events:

| Sample | Space | Recorded result |
| --- | --- | --- |
| **Seongsu Pop-up** · Ray-Ban Meta × Messenger | ~590 m² ground floor, three columns, annex | 6 areas, 117 installations, 9 wall graphics, 18-page planning PDF |
| **KINTEX Creator Day** · Instagram × Threads | 40 × 30 m area inside Hall 1B | 167 installations, 11 wall graphics, 22-page planning PDF |

Each sample opens as a **recorded** Muse session: a real design and planning document that Muse produced live, saved so the demo works without a key. Choose **Design from scratch** to run Muse live on the same drawing.

## Repository

| Path | What it is |
| --- | --- |
| `web/` | Next.js app: studio UI, 3D viewer (React Three Fiber), API routes |
| `web/server/plans/` | Muse workflows: drawing reading, design, chat, photography, planning document, PDF previews |
| `web/server/agent/` | Model provider config and Muse design tools |
| `web/lib/plans/schema.ts` | The drawing/design contract, validated at runtime |
| `data/samples/` | Sample drawings, briefs and recorded sessions, with provenance notes |
| `video/` | Remotion sources for the 3-minute launch film, captured from the app |
| `architecture/` | Architecture overview and decision records (ADRs) |

Projects, original files and planning documents are stored in local SQLite (`web/data/`, gitignored). There is no separate backend.

```bash
cd web && pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

## Limits, stated plainly

- Muse proposes and the app checks geometry, but nothing here is a structural, fire-safety or crowd-flow simulation. Ceiling heights read from a drawing are assumptions until confirmed.
- Scale always needs a human to confirm it.
- Costs in the planning document are estimates for the client to replace.
- New uploads support PDF, PNG and JPG. Export CAD files to PDF first.
- Brand URLs are kept as bookmarks with notes. Page content is not scraped, and no logos or product photos are bundled.

Third-party assets and licenses are listed in `web/public/assets/cc0/README.md` and `web/licenses/`. Venue drawing sources are listed in `data/samples/README.md`.
