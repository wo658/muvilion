# One-minute SaaS demo video: research and revision plan

Written: 2026-11-01. Subject: Muvilion-Designer-Film, 60 seconds.

## Research basis

- User reference [LangEase](https://www.youtube.com/watch?v=SgmuplXU2iY): an earlier viewing showed large typography, selective UI zooms, and cursor and screen motion. We apply this to a structure that delivers one piece of information at a time.
- User reference [Lovio](https://www.youtube.com/watch?v=_PLSHdVR4no): an earlier viewing showed a central input box over the output and layered UI. For spatial design we turn this into the causal chain attachments → input → layout → camera → photo.
- The studio [Zelios](https://zelios.agency/) presents both works as product introduction and launch cases. Their performance figures are not used as grounds for predicting this video's effect.
- [Screen Studio's animation guide](https://screen.studio/guide/animations): screen and cursor movement speed and smoothness can be controlled. In our video, rather than adding lots of motion, we follow only the necessary clicks and give time to read the results.

The timings, fonts and zoom factors below are this video's editing judgements, not rules from the sources.

## Problems found first and fixes

| Segment | Problem | Fix |
|---|---|---|
|0–15s|Send zoom and travel are large, and the transition to the space after source absorption is fast|Keep the core absorption motion; reduce maximum zoom and horizontal travel|
|15–20s|Abrupt switch to the real UI; the feature explanation is vague|Short caption 'AI arranges your space.' and a steady entry|
|20–25s|Zooms to 1.75× within 0.3–0.5s before the first click|1.48× cap, at least 0.9s entry, time to see the result|
|25–33s|Similar UI compositions in a row|Explain the purpose of the view change with a title; no excessive re-zoom|
|33–35s|Abstract wording|Concrete 'Design it. / Then capture it.' to foreshadow capture|
|35–41s|Copy and input box improved, but top margin differs from the previous scene|Keep shared glass material and buttons; check the intended two lines and reading time|
|41–49s|Long real-app descriptions are hard to read on an ad screen|Do not require reading the full description; convey one meaning with 'Find the best angle.' / 'Capture. Refine. Repeat.'|
|49–57s|The photo pops out too large from a small size|Start at 0.28×, scale up over 2s, keep a safe distance between title and photo|
|Overall|A shrink bridge repeated on every cut distracts the eye|Keep it only at context changes at 15/35/41/49/57s, with half the blur strength|

## Common standards

- Ad copy: one message per screen; titles of 3–6 words recommended. Break English lines at units of meaning.
- At least 130px safe margin left and right of titles. Small body text in the real app is not treated as text that must be fully readable.
- Titles, send buttons, glass corners and shadows use the same roles and specifications.
- Keep the speed labels so generation and capture are not mistaken for real-time speed.
- Add short explanatory copy so it is understandable without voice. Keep the background music and the keyboard sound effects in the two input scenes.
- Do not add participant features, PDF proposals or unverified automatic URL collection.

## Verification plan

Review the existing 60 seconds in order and compare a full contact sheet at 2-second intervals and frames around transitions. After revision, decode the full render, confirm 60s/1800 frames, and visually check copy, buttons and photo composition. Record the inspection evidence and limits below when done.

## Applied changes and verification results

- Final version with the fixes above applied: `out/muvilion-designer-reviewed-60s.mp4`.
- Compared the full 60 seconds in order at 2-second intervals (`audit-before.jpg`, `audit-after.jpg`); separately checked the most abrupt part, 19.6–21.4s, at 0.2-second intervals (`audit-apply-transition.jpg`). This inspection is a frame and timeline review and does not claim to replace a person watching continuously in real time.
- Ad titles, the two-line input copy, the send button and the final photo are not clipped in the inspected frames. Some long body text of the zoomed real app is intentionally cropped; this is not a tutorial structure that makes all app body text readable.
- Click camera cap 1.48×, minimum 28-frame entry. Opening send maximum 1.35×. Photo card scale-up 60 frames. Repeated shrink effect removed between app cuts with the same meaning.
- H.264 1920×1080, 30fps, 1800 frames, video 60.000s. AAC packet duration 60.011s. No errors in full decoding.
- Verified with video ESLint/TypeScript and repository web test/typecheck/lint, engine pytest/ruff.
