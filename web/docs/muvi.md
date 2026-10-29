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

Preview `/muvi/gallery`: inspect (survey and focus), measure (compare spacing), arrange
(reach, adjust, release), and paint (two soft finishing passes). Each is a five-second,
in-place phrase with neutral entry/exit. These replace the sketch and partition studies.
Staged result geometry was removed: gestures must work with any real-space output.
Paint retains only a small hand-held brush, attached to the working hand; no wall or
painted swatch is baked in. Other clips hide the brush.
Eyes lead attention, hands arrive sequentially, feet stay planted, and quintic easing
softens changes of intent. Individual authored poses live in `scripts/muvi-motions/`.

The shared `MuviModel` accepts `workHeading` (radians, local +Z work direction).
This orients the whole phrase in scene coordinates without camera-facing behavior.
An embedding scene can supply the direction of work without supplying result geometry.
The gallery previews left/right/away headings; its floor ring is an orientation aid only.
No heading, mascot, prop or gesture enters the plan document, persistence or engine.

These are prepared animation assets for Muse activity presentation. Live Muse event
wiring is not implemented by this gallery. A future caller should choose inspect for
examining context, measure for comparing spacing, arrange for composing/adjusting, or
paint for applying appearance, and return to idle when work stops. Playback is not an
indication that a proposal has been applied or a result validated. Existing drawing
roaming is unchanged. Pause, reduced-motion, hidden-page behavior and fallback remain.
