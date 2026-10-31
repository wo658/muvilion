# Spatial designer — opening minute

60 seconds · 1920 × 1080 · 30 fps. English app UI, source documents, prompts and model replies; English editorial copy and original background music. No narration. This replaces the previous three-minute cut. Composition: `Muvilion-Designer-Film`; render with `npm run render:film` from `video/`.

## Current scope

A 60-second product advertisement: 39 seconds of editorial motion and space presentation, 21 seconds of actual app footage. English throughout, original music, no participants. The central floating composer is an editorial presentation inspired by the requested Spline feel, not a newly shipped app interface.

## Screen plan

| Time | Screen and purpose |
|---|---|
| 0–8s | Large idea-led typography; PDF, brief and brand cards converge |
| 8–12s | Actual PDF zoom establishes the real source |
| 12–15s | Actual project brief shows purpose |
| 15–18s | Actual brand bookmark shows context |
| 18–27s | Central floating composer, typed prompt, send pulse |
| 27–37s | Editorial blueprint-to-volume build using saved layout coordinates |
| 37–41s | Actual generation/review at 5× speed |
| 41–45s | Actual Apply changes interaction |
| 45–48s | Actual camera preset change |
| 48–57s | UI-free crop of the same design; concept-frame treatment |
| 57–60s | Brand close |

Scene planning and transitions are separate modules: `DesignerAdIntro.tsx`, `DesignerAdSpace.tsx`, and `DesignerAdBridges.tsx`. The bridges carry card shapes into the composer, the send pulse into a spatial grid, and a camera aperture into the hero. The hero freeze-frame is editorial framing of actual app footage, not a claim that a new photo-generation request ran.

## Capture provenance

Actual 1280 × 720 app captures are in `public/designer-minute/`. Click markers and the editorial cursor follow coordinates recorded from real controls and real mouse drags. Typography, camera crops, click rings and transitions are editorial Remotion animation. They do not invent app state. Brief and brand content were translated before capture. All visible installation labels and model responses were generated in English.

The initial input take was recorded on the main local app. A development hot reload interrupted that run; the identical request and source project were run again on an isolated local app for uninterrupted generation footage. The successful run produced 16 installations, including two sofas forming a four-seat lounge, and four zones. The final reviewed result was actually applied and saved. Clips omit waiting intervals and show their speed change. No automatic brand URL crawling, image generation or certified spatial validation is claimed.

The real source remains the official Moscone West level 3 PDF, page 1, cropped around room 3011. Crop x633 y350 width204 height136 on a1224×1584 preview; scale15m per134px. Floor outline, calibration and ceiling height are concept assumptions. See `../input-reveal/README.md` and repository sample provenance. The Community Studio brief and Facebook reference notes are authored demonstration material, not an official Meta event.

`encode-minute.py` converts timestamped browser frames to constant 30fps video, preserving holds and writing interaction traces. Raw captures and project exports remain ignored under `generated/`. `build-music.py` creates the original instrumental soundtrack; its AAC master has 9dB gain. The one-minute composition adds its own closing fade. No third-party music or reference footage is included.

Visual direction: Apple Creator Studio launch film (https://www.youtube.com/watch?v=ISYIEmQxs2M), with large typography, restrained spacing and responsive product reveals. The earlier source captures and concept photos remain available for future designer-focused chapters, but the participant clip is removed from the current assets and timeline.
