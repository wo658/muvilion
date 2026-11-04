# Muvilion motion study

A standalone Remotion 4.0.539 authoring project. This is a 10-second, 1920×1080,
30 fps silent concept video, not a recording of the app or measured engine output.
It is not a deployed service and is not imported by the application.

## Run

Requires Node.js 24+ and npm. From `video/`:

```sh
npm ci
npm run dev
npm run lint
npm run render
```

The first render downloads Remotion's Chrome Headless Shell. On macOS the Korean
text uses Apple SD Gothic Neo; other platforms should install Noto Sans KR.
Review the font before rendering on another platform. Outputs go into ignored `out/`.

## Timing and provenance

- 0–3s: top-down schematic and booth appearance.
- 3–6s: authored booth rearrangement, revealing a central aisle.
- 6–10s: camera tilt and wall/furniture extrusion into a 3D study model.

`src/Composition.tsx` reads the repository-authored `fixtures/sample_hall.json`
for the 40×30m footprint, obstacles, and 24 booth dimensions. The fixture remains
separate from user-facing venue samples. Positions before/after, furniture, wall
heights and animation are authored illustrative data, not optimization results or
validated circulation. The video carries an explicit Korean concept label.
No customer data, externally sourced venue drawings or paid media are included.
Colors reuse `web/lib/ui/tokens.ts`. No mascot is included in this study.

Remotion and its related packages are pinned together. See the upstream Remotion
license for eligibility; React/Three.js dependencies have their own licenses.
The official agent skills are installed separately in the operator's personal
skills folder, not vendored here.

## Verification

`npm run lint` checks ESLint and TypeScript. Inspect plan, rearranged plan and 3D
frames in Studio and verify the rendered MP4 with ffprobe. All motion is driven by
Remotion frame time, including the orthographic camera. There is no live clock,
network call, user interaction or simulation in the composition.

The initial scaffold's dependency audit (2026-10-31) reports transitive Zod and
minimatch advisories. This is a local authoring tool using trusted static inputs;
do not expose its Studio server as a public service. Recheck upstream fixes before
turning this into an automated service. Do not apply npm audit's suggested old
Remotion downgrade or incompatible major overrides blindly.

## Current three-minute launch film

The latest English product film is `Muvilion-Launch-Film`: 180 seconds, 1080p, 30 fps, with newly
recorded Seongsu and KINTEX demos through completed planning reports and PDF export.
Run `npm run render:launch`. See [the timeline and recording provenance](launch/README.md).
