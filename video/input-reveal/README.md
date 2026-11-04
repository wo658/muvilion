# From inputs to space — 10-second motion study

`Muvilion-Input-Reveal` is a 1920×1080, 30 fps, 300-frame composition. Input cards and the paper-to-space transition are editorial motion graphics. The final space is captured from the actual app and uses a real PDF-derived document. Processing time is compressed; this is not a ten-second performance measurement.

## Reference direction

- [Apple — Introducing Apple Creator Studio](https://www.youtube.com/watch?v=ISYIEmQxs2M): large, sparse typography; quick transforms; short audio punctuation. Inspected the opening title, the text/effect transition around 10 seconds and the design/device transition around 15 seconds.
- [Spline — Introducing Spline V2](https://www.youtube.com/watch?v=i8g1dnPOrCc): user-supplied reference for a product editor and 3D scene as the hero.

No Apple or Spline footage, music, logos or design files are used. The film uses muvilion's existing tokens, original text, self-synthesized audio and actual app captures.

## Input provenance

- Drawing: `video/input-reveal/source/west-L3.pdf`, page 1, from [Moscone's official West Level 3 floor-plan page](https://moscone.com/floorplans/moscone-west-level-3-floor-plan). The drawing is a work of Moscone Center/ASM Global, kept with attribution for development and testing only. It moved here from `data/samples/moscone/` when Moscone stopped being an app sample (2026-11-04). The film is a local development sample; public redistribution rights for the source drawing have not been established.
- Room: 3011, cropped at x=633,y=350,width=204,height=136 in the engine's 1224×1584 page preview. `cropEvidence` preserves the original vector geometry, IDs and page/crop provenance. It is not a fabricated rectangular source image.
- Scale: manually calibrated from the printed 0–15m bar, approximately 134 preview pixels. Crop bounds are 22.8358×15.2239m, including border margins. Floor outline is manually reviewed; wall/ceiling heights are estimates. This does not establish measured as-built dimensions or construction/safety approval.
- Brief: `brief.txt`, independently authored fictional Community Studio program, not an official Meta event.
- Brand: `https://www.meta.com/facebook-app/` bookmark plus an authored service/design summary supplied to Muse. The current app does not automatically fetch a pasted brand URL. The card says “공식 URL + 참고 설명”; the sequence must not be described as automatic web crawling.

## Reproduce

With the web app running, run `node --import tsx ../video/input-reveal/prepare.mts` from `web/`. It calls the actual Next.js extraction endpoint, crops the real document and creates a **new** local project containing the PDF, brief and brand source. It never overwrites an existing project. `generated/` contains local IDs, requests and raw model events and is ignored.

Muse generation uses the same `/api/plans/design` NDJSON endpoint as the app. The final reviewed response contains 27 objects and 6 zones. Two explicit manual adjustments removed a plant/stage overlap and expanded the stage zone to include its backdrop; see `generation-summary.json`. The result is saved to the new project, then the app's camera is recorded. `finalize.mts` documents this recorded run's review edits; it is not a general postprocessor for other model runs. Source inputs and model output are retained locally for provenance. No previous fictional Atelier footage is used.

From `video/`, run `npm run dev` and open **Muvilion-Input-Reveal**, or `npm run render:inputs` for an MP4. `python3 video/input-reveal/build-audio.py` from the repository root regenerates the original cue without external samples. Font is Apple SD Gothic Neo on macOS, with a sans-serif fallback.

For crisp PDF cards, run `python3 video/input-reveal/render-pdf-assets.py` (optional offline video tooling; install `pypdfium2` and `Pillow` in a separate environment) from the repository root after preparing the inputs. This renders the same original PDF and crop at 1400px width; this historical video keeps its recorded source geometry. The current application does not require Python.
