# Spatial designer film

180 seconds · 1920 × 1080 · 30 fps. English editorial copy and captions, original instrumental music, no narration. Composition: `Muvilion-Designer-Film`. Render with `npm run render:film` from `video/`.

## Story

| Time | Content |
|---|---|
| 0:00–0:15 | Kinetic typography and PDF / brief / brand cards |
| 0:15–0:45 | Actual workspace and attached sources |
| 0:45–1:22 | Actual Meta AI design request, live draft, review and apply |
| 1:22–1:48 | Explore and conversationally revise the design |
| 1:48–2:40 | Actual camera workflow, selected photo, manual angle adjustment and retake |
| 2:40–2:50 | Explain the three AI-assisted steps |
| 2:50–2:56 | Separate local exhibitor booth preview |
| 2:56–3:00 | Closing |

## Evidence and limits

The source is the official Moscone West level 3 PDF, page 1, cropped around room 3011. The prior sample retained the original PDF. Crop: x633 y350 width204 height136 on a1224×1584 preview; scale calibration15m per134px. Room outline and ceiling height are assumptions, not an as-built survey. The original venue document is linked in `../input-reveal/README.md` and the repository sample provenance; no new third-party footage or music is bundled.

The Community Studio brief and brand notes are authored demonstration content, not an official Facebook event. The attached Facebook URL is a reference with supplied notes; automatic URL crawling is not demonstrated.

The video records actual local app behavior. The design was freshly generated from the attached context with 20 objects and six zones, reviewed and applied. A second real request changed stage color and adjusted lounge seating. Generation clips shorten waiting time. Editorial typography, source-card convergence, framing, zooms and photo reveals are Remotion animation; they are not claims about the app UI.

The actual photography workflow rendered camera candidates and used model review to select `concept-01.jpg`. `concept-02.jpg` was captured after manual camera adjustment and was not reviewed again by AI. Photos are real scene renders, not image-generation output. Editorial zoom crops the surrounding blank canvas. Photography images are session-only in the app and are retained separately here.

The six-second participant segment shows a separate local demo listing created from the source room with two empty booth zones. It previews browsing/application capability; it does not show a completed application, approval, booth design or PDF proposal. There is no live event, payment or external publication.

## Assets and reproducibility

`public/designer-film/` contains actual UI captures, scene photos and the generated soundtrack. `build-music.py` synthesizes an original 180-second instrumental bed (NumPy and Python); no sampled third-party song is used. Encode its generated WAV to AAC with ffmpeg. `encode-captures.py` converts timestamped browser JPEG sequences using ffmpeg. Raw frames, project exports and local booth access credentials are excluded under `generated/`.

Visual reference: [Apple — Introducing Apple Creator Studio](https://www.youtube.com/watch?v=ISYIEmQxs2M), using large typography, generous spacing, layered cards and product reveals as direction. No Apple footage, audio, marks or UI is included. Original user reference: https://www.youtube.com/watch?v=i8g1dnPOrCc.

The film duration follows the three-minute demo deliverable in the [Meta AI Developer Hackathon details](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details).
