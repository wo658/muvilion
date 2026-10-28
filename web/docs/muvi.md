# Muvi mascot

Muvi is an original muvilion mascot based on the approved pale-periwinkle M-shaped
character concept. The model is authored locally; it has no third-party meshes,
textures, remote services or runtime generation dependencies.

- `/muvi`: interactive 3D viewer, eight motion choices, floor-click / arrow-key
  movement, orbit, zoom, pause, reset and downloads.
- Chat: animated greeting and a 2D avatar linking to the viewer in a new tab,
  preserving the active conversation.
- `/mascot/muvi-v1.glb`: self-contained glTF 2 binary (~393 KB), Y-up, facing +Z.
  Named transform groups animate the body, arms, feet and eyes. This is a rigid-part
  character rig, not a humanoid skinned skeleton or automatic retargeting rig.
- `/mascot/muvi-face.svg`: vector face used by the chat and favicon.

Rebuild with `pnpm build:muvi` from `web/`. The tracked generator is
`scripts/build-muvi.ts`. Commit the regenerated GLB alongside generator changes.
Idle, hello, walk, run, think, idea, cheer and rest are embedded looping clips.
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
