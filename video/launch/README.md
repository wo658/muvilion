# Muvilion — from context to a complete proposal

**180 seconds · 1920 × 1080 · 30 fps · English · original instrumental soundtrack.**
Composition `Muvilion-Launch-Film`; `npm run render:launch` produces
`out/muvilion-launch-3min-en.mp4`. The earlier 60-second Designer Film remains available.

The visual baseline is the latest 75-second launch teaser in `wt/teaser-part1` (2026-11-03),
inspired by [Introducing 3D Make in Kimi](https://www.youtube.com/watch?v=VtzELsWFXV4).
Its morphing white panel, centered composer, shimmering chapter pills, sparse typography and
Muvi end card are retained in `LaunchPrimitives.tsx`. No reference footage or audio is copied.
The new film completes the three-minute format with today's app and the two current samples.

| Time | Scene | Source | Camera |
| --- | --- | --- | --- |
| 0:00–0:20 | Opening in 3D (`LaunchOpening3D.tsx`) | Saved Seongsu design, sources, composer | Separate file |
| 0:20–0:27.5 | Sources library | `popup-sources.mp4` | Swings in from a 38° yaw, push-in on the Sources dialog |
| 0:27.5–0:40 | Seongsu overview | `popup-overview.mp4` | Rises from a 62° pitch, then dollies to near full frame |
| 0:40–0:50 | Fitting bars / photo walk | `popup-detail.mp4` + report photos 2 and 3 | Split layout; two saved photos fly in at depth |
| 0:50–1:00 | Top / Overview controls | `popup-top.mp4` at 0.96× | Flat for Top, pitches back on the Overview switch |
| 1:00–1:10 | Listening lounge | Report photo 4 (`z-lounge`) and its report dimensions | Photo swings in, slow push-in on the sofas |
| 1:10–1:12.5 | Chapter pill | — | — |
| 1:12.5–1:25 | KINTEX event area | `kintex-overview.mp4` | Flies in from far, then pushes in on the 40 × 30 m area |
| 1:25–1:35 | Eight program areas | `kintex-top.mp4` at 0.96× | Word-per-beat list; panel pitches on the Overview switch |
| 1:35–1:45 | Zone detail | `kintex-detail.mp4` + report photos 3, 1 and 6 | Panel rolls in; three saved photos fan in |
| 1:45–1:47.5 | Chapter pill | — | — |
| 1:47.5–1:57.5 | Seongsu report | `popup-report.mp4` | Rises flat, cropped to the document column |
| 1:57.5–2:10 | Seongsu area guide | `popup-areas.mp4`, then PDF pages 3–8 | Fan of area pages; push-in on Fitting bar zone |
| 2:10–2:20 | KINTEX report | `kintex-report.mp4` | Opens like a door from the left |
| 2:20–2:32.5 | KINTEX area guide | `kintex-areas.mp4` over PDF pages 3–10 | Tilted wall of pages; app panel in front |
| 2:32.5–2:40 | Open planning PDF | `popup-export.mp4` at 0.88×, `popup-pdf.png` | Push-in on the action, the opened PDF flies in |
| 2:40–2:52.5 | Exported proposals | Seongsu (16 pages) and KINTEX (20 pages) PDFs | Two decks fan out while the camera orbits |
| 2:52.5–3:00 | Muvi and Muvilion end card | — | — |

All camera moves are CSS 3D transforms on one perspective stage in `LaunchFilm.tsx`
(`Pane`, `Group`, `track`): bezier-eased keyframes for yaw, pitch, roll, dolly and an in-panel
push-in (`focus`). Headlines rise word by word on the 0.625-second beat of the 2.5-second bar.
Panels settle flat before text must be read.

## Recording and truthfulness

All app footage was recaptured on 2026-11-05 from the code at `03f3673` plus English sample
localization and one layout fix (a spaced count badge for "Items to review"), at 1440 × 810 CSS
pixels and 1.5× device scale (2160 × 1215 frames), so push-ins up to about 1.5× stay sharp. A fresh
SQLite directory keeps production/user projects intact. The localized samples were checked against
`03f3673`: geometry, zones, objects and all saved photographs are identical; only text and the
artifact edit history differ. The samples contain 98 and 144 installations, respectively. Reports
contain six and eight area guides and seven and nine saved scene photographs. Both exported PDFs
(16 and 20 pages) are actual app output, including review notes and unestimated fees.

The saved Muse demos are opened and explored; the film does **not** portray loading a recording
as live model generation. The composer is editorial. There is no staged geometry build, no old
failed generation clip and no old review/apply footage. Every app chapter carries a saved-demo
caption. UI language, briefs, object labels and report copy are English. Existing scene photos
are retained from the recorded run, and the typography/brief translation is editorial localization.
The reports are completed planning material, not safety certification or construction documents.

Screen recordings play at 1× except Top/Overview clips at 0.96× and PDF action at 0.88× to align
with music bars. All scene cuts are on 2.5-second bars. Source footage is trimmed; waits are omitted
between chapters. Only the Next.js developer indicator is hidden during capture. App controls,
review flags, hover highlights and saved-demo notices are retained. No pointer is drawn and there
are no fabricated pointer clicks. Panels are moved, tilted and cropped in 3D; the footage itself is
never altered. Photographs shown beside a recording are saved report photographs of the same demo,
labelled with their report area (photo 3 is the Photo walk; the listening scene uses photo 4, the
Listening lounge). Area-guide pages and proposal decks are pages of the PDFs exported in the same
capture run.

## Reproduce

Use an isolated current app with the repository's samples. `capture-latest.cjs` uses Playwright
installed separately (set `PLAYWRIGHT_MODULE` to its package path); system Chrome is required.
`FILM_ORIGIN` defaults to `http://localhost:3121`. It creates new local sample projects, records
back-to-back device-scale CDP screenshots (21–27 fps; headless screencast frames are CSS-pixel
size) with wall-clock timestamps, and exports both planning PDFs. Buttons are activated with DOM
click events. Raw captures and
PDFs are under ignored `out/latest-captures/`. Override the viewport with `FILM_W`, `FILM_H`
and `FILM_DPR`.

Run `python3 launch/encode-latest.py` from `video/` to normalize the recordings to 30 fps using
FFmpeg. Odd frame dimensions are padded by one pixel, never stretched. Clips are encoded with CRF 14. PDF page PNGs
are rendered with macOS PDFKit: `swift launch/render-pdf-pages.swift <pdf> <prefix> 2200`. `floor-plan.png` and `fitting-bar.webp` are copies
of the repository-authored Seongsu sources. All distributable footage is in `public/launch-current/`.
`localize-samples.py` records the authored English localization and preserves spatial state.

Music is the existing original 180-second `designer-film/music.m4a`; typing and the synthesized
launch effects are reused. Muvi comes directly from the canonical SVG in `web/public/mascot/`.
No third-party soundtrack, footage or newly generated imagery is included.

## Verification

See `quality-review.md` for render, frame inspection, PDF and repository checks.
