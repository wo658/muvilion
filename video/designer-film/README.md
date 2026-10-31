# Spatial designer — opening minute

60 seconds · 1920 × 1080 · 30 fps. English app UI, source documents, prompts and model replies; English editorial copy and original background music. No narration. This replaces the previous three-minute cut. Composition: `Muvilion-Designer-Film`; render with `npm run render:film` from `video/`.

## Current scope

The opening minute covers the actual PDF, project brief, brand reference, typing a request, live design generation, applying the reviewed result, switching camera presets and dragging to orbit. Participant applications, participant booth design and proposal PDFs are future work and do not appear in the film. Their app entry points are hidden; existing implementation and data are retained.

## Timeline

| Time | Actual interaction |
|---|---|
| 0:00–0:03 | Opening typography |
| 0:03–0:07 | Click Drawing settings |
| 0:07–0:11 | Zoom and fit the PDF room |
| 0:11–0:16 | Open the English planning brief |
| 0:16–0:20 | Open the brand bookmark and supplied notes |
| 0:20–0:27 | Type the English prompt and press Enter |
| 0:27–0:42 | Actual generation and review, edited at 5× speed |
| 0:42–0:47 | Click Apply changes, then collapse Muse |
| 0:47–0:52 | Click Top and Overview |
| 0:52–0:58 | Drag to orbit the saved design |
| 0:58–1:00 | End of the opening minute |

## Capture provenance

Actual 1280 × 720 app captures are in `public/designer-minute/`. Click markers and the editorial cursor follow coordinates recorded from real controls and real mouse drags. Typography, camera crops, click rings and transitions are editorial Remotion animation. They do not invent app state. Brief and brand content were translated before capture. All visible installation labels and model responses were generated in English.

The initial input take was recorded on the main local app. A development hot reload interrupted that run; the identical request and source project were run again on an isolated local app for uninterrupted generation footage. The successful run produced 16 installations, including two sofas forming a four-seat lounge, and four zones. The final reviewed result was actually applied and saved. Clips omit waiting intervals and show their speed change. No automatic brand URL crawling, image generation or certified spatial validation is claimed.

The real source remains the official Moscone West level 3 PDF, page 1, cropped around room 3011. Crop x633 y350 width204 height136 on a1224×1584 preview; scale15m per134px. Floor outline, calibration and ceiling height are concept assumptions. See `../input-reveal/README.md` and repository sample provenance. The Community Studio brief and Facebook reference notes are authored demonstration material, not an official Meta event.

`encode-minute.py` converts timestamped browser frames to constant 30fps video, preserving holds and writing interaction traces. Raw captures and project exports remain ignored under `generated/`. `build-music.py` creates the original instrumental soundtrack; its AAC master has 9dB gain. The one-minute composition adds its own closing fade. No third-party music or reference footage is included.

Visual direction: Apple Creator Studio launch film (https://www.youtube.com/watch?v=ISYIEmQxs2M), with large typography, restrained spacing and responsive product reveals. The earlier source captures and concept photos remain available for future designer-focused chapters, but the participant clip is removed from the current assets and timeline.
