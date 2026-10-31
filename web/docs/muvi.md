# Muvi mascot

Muvi is an original muvilion mascot based on the approved pale-periwinkle M-shaped
character concept. The model is authored locally; it has no third-party meshes,
textures, remote services or runtime generation dependencies.

- `/muvi`: interactive 3D viewer, twelve motion choices, floor-click / arrow-key
  movement, orbit, zoom, pause, reset and downloads.
- Chat: animated greeting and a 2D avatar linking to the viewer in a new tab,
  preserving the active conversation.
- `/mascot/muvi-v1.glb`: self-contained glTF 2 binary , Y-up, facing +Z.
  Named transform groups animate the body, arms, feet and eyes. This is a rigid-part
  character rig, not a humanoid skinned skeleton or automatic retargeting rig.
- `/mascot/muvi-face.svg`: vector face used by the chat and favicon.

Rebuild with `pnpm build:muvi` from `web/`. The tracked generator is
`scripts/build-muvi.ts`. Commit the regenerated GLB alongside generator changes.
Idle, hello, walk, run, think, idea, cheer, rest, inspect, measure, arrange and paint are embedded looping clips.
Walk/run are in place; the viewer moves the character root toward a bounded target.
The standalone viewer remains a mascot playground. The drawing's 3D view also
shows an optional decorative loop, with pause and layer visibility controls. Its
dimensions frame an approximate loop; it intentionally does not follow floor
boundaries, avoid walls, or represent a measured person or real navigation. It has
no connection to engine calculations, AI actions or saved layout objects.

Use `MuviAvatar` for the start screen, chat headers and the chat
launcher. Run `pnpm build:muvi-icons` to regenerate the 16/32/48px favicon and the
180px Apple icon from the same SVG. The old default favicon is replaced as well.

The 3D module loads on demand. Hidden pages, reduced-motion preferences and the
pause control stop the render loop. WebGL/model failures fall back to the SVG face.
No project state or model credentials are used by the mascot.

The source concept is in the repository owner's private design notes; production
assets above are tracked and require no private files to build or render.

## Spatial designer studies

Preview `/muvi/gallery`: inspect (big survey and excited presentation), measure
(full-body tug and spring recoil), arrange (front-wall hammering), and paint
(broad brush sweeps, foot taps and a triumphant flourish). All four are five-second
in-place cartoon phrases with neutral loop entry/exit. Large anticipatory poses,
fast actions, delayed recovery and up to 12% squash/stretch are intentional.
Feet can tap/rock with floor clearance. Individual poses live in `scripts/muvi-motions/`.

Tools include a toy hammer, marked retracting tape and broad brush. No staged result
geometry is included. The hammer arm rises overhead and behind the head, holds, then swings down toward local +Z while the torso gives a restrained recoil above the planted feet;
the striking face is oriented toward a vertical wall and all three contacts coincide.
A short star-shaped flash and shrinking diamond sparks burst from each fixed contact.
The unlit effect uses dedicated artwork tokens and no borrowed textures. It does not
follow the recoiling hammer and cannot enter the document or be mistaken for saved debris.
Tool/FX transforms are baked in the same GLB; constant animation keys are optimized.

`MuviModel.workHeading` rotates a phrase into the scene's work direction. The gallery
previews left/right/away headings with a floor marker. Existing drawing roaming and
its small companion scale are unchanged. Live Muse event wiring is still separate:
these assets do not imply a proposal has been applied or validated. Pause, reduced
motion, hidden-page handling and WebGL/model fallback remain in effect.

### Motion references (reviewed 2026-10-29)

- [Animation Mentor / Chris Hurtt: Anticipation](https://www.animationmentor.com/blog/anticipation-the-12-basic-principles-of-animation/): opposing preparation and sufficient energy build-up before fast actions; applied to all four motions.
- [Atif: stylized explosion breakdown](https://realtimevfx.com/t/stylized-frag-launcher-explosion-overwatch-inspiration-breakdown-posted/1894?page=2): separating instant flash, burst and outward sparks with different lifetimes; adapted into a much smaller cartoon hammer impact.

References inform timing and structure only. All motion functions, effect meshes and
tools here are original; no reference images, videos, meshes or textures are bundled.

## In-space size

Drawing-space Muvi uses a maximum scale of 0.4, about 0.85 scene units tall.
Venue dimensions never enlarge it; tiny spaces can reduce it further. It is visually
about half the 1.8-unit walking reference, with no physical or simulation meaning.
The standalone motion gallery and chat avatar retain their close-up framing.

## Live designer operations

The existing `/api/plans/design` NDJSON stream includes `operation` events before tool execution, with a request UUID, monotonic sequence, and one of `inspect`, `measure`, `arrange`, `paint`. `edit_design` lets the model choose the gesture per atomic group; omitted cues default to arrange. Brief/asset tools inspect, review measures, and concept generation paints. These are activity cues, not successful execution receipts. No extra model request or animation tool call is needed.

The browser validates sequence/run identity separately from draft revisions and holds the latest cue while the model proceeds. Studio scopes it to the current drawing/references and clears it on completion, cancellation, failure, context change and unmount. The stream has a client deadline as well as the server deadline. The mascot stays at its current patrol position while performing a gesture; no navigation or collision target is inferred. Existing pause/hide/reduced-motion/visibility rules take priority. Operation state is never serialized into plans, undo, exports or SQLite. Chat and booth-specialist transports do not yet emit these cues.
