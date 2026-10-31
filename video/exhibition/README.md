# Muse Atelier recorded showcase

A 20 × 16 m fictional exhibition authored for the product video: 67 objects across gallery, lounge and circulation zones. The builder validates the PlanDocument schema and existing design warnings. This is not an engine-generated layout or a construction/safety validation. The source image and `opencv` transport field are compatibility metadata for this authored document, not evidence of an extraction run.

`muse-atelier.muvilion.json` is the final app export and can be imported into the app. `build.mts` recreates the initial space; run from `web/` with `node --import tsx ../video/exhibition/build.mts`. Add `--create` to create a new project in the running localhost:3000 app. Generated files and local project IDs are ignored.

## What was recorded

The actual app was used on 2026-10-31. Muse received the Korean request to change the black Imagine and Explore partitions to blue while preserving the remaining layout. The resulting proposal was reviewed and applied through the UI. The exported result changes the color and AI provenance of `panel-0` and `panel-2`, preserving all object geometry. Captured chat text is the actual app output. The space itself was manually authored.

`public/capture/orbit.mp4` is a real mouse-orbit recording of the app, encoded at 1920×1080/30 fps. `overview.png` and `live-draft.png` are matching cropped app captures before and during the real proposal. `final-full.jpg` is the complete applied screen, cropped in the composition to emphasize the conversation. Model waiting time is omitted; the wipe is editorial animation, not app behavior.

The 10-second edit opens on the completed space (0–2s), focuses on the real conversation (2–4s), wipes between before and proposal captures (4–5.5s), then returns to the recorded orbit (5.5–10s). Remotion supplies framing, typography, crops and timing. Reference: [Introducing Spline V2](https://www.youtube.com/watch?v=i8g1dnPOrCc), used for pacing and editor-focused presentation only; no video, music or artwork from it is redistributed.

Furniture models are the app's existing CC0 assets; retain their existing asset-manifest provenance. The exhibition uses fictional Meta/Muse branding already supported by the app and is not an official event reproduction. `build-audio.py` synthesizes the original soft music cue without external samples (`python3 video/exhibition/build-audio.py`).

From `video/`: `npm ci`, `npm run dev`, select **Muvilion-Atelier**, then `npm run render:atelier`. Output: `out/muvilion-atelier-10s.mp4` (H.264, 1080p, 30 fps, AAC audio). Font uses Apple SD Gothic Neo on macOS, with sans-serif fallback elsewhere.
