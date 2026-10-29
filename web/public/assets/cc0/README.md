# Downloaded CC0 assets

Downloaded 2026-10-28: six ambientCG PBR materials and six Poly Haven models at 1K. These are actual local files, not remote placeholders. See [manifest.json](manifest.json) for each file's local path, original URL, byte length and SHA-256.

Downloaded 2026-10-29: nine exhibition GLBs from 3DAssets.dev (236,488 bytes total): two partitions, a plinth, vitrine, reception desk, information board, track spotlight, and horizontal/vertical truss. These source-authored AI-generated models are CC0 concept assets, not manufacturer specifications. The catalog now contains 21 assets.

## Use

Next.js serves this directory at `/assets/cc0/`. A model entrypoint is `/assets/cc0/models/modern_arm_chair_01/modern_arm_chair_01_1k.gltf`; retain its sibling BIN file and textures directory. Load model entrypoints from the manifest. Material JPG paths are listed under each material's files. No GLB conversion, mesh simplification or image recompression was performed.

Only Color, NormalGL, Roughness, Metalness and AmbientOcclusion JPGs present in the material archives are retained. Original ZIPs, Blender scenes, displacement, NormalDX and preview images are omitted to avoid duplicate storage. This is a static asset inventory, not a user-facing example catalog. Muse's `search_design_assets` tool uses the typed shared catalog in `lib/assets/catalog.ts`; proposals reference IDs and render after user Apply. The inventory does not claim calibrated lighting simulation.

## Provenance and license

- ambientCG: https://docs.ambientcg.com/license/ — CC0 1.0, including commercial use and redistribution. Source ZIP hashes are in the manifest.
- Poly Haven: https://polyhaven.com/license — CC0 assets, including commercial use and redistribution. Website text, logos and preview renders are not bundled.
- 3DAssets.dev: each model source page linked in the manifest declares CC0 1.0 and AI-generated provenance. Original self-contained GLBs are retained without re-encoding. Only model files are bundled; website previews and text are not redistributed.
- CC0 legal text: https://creativecommons.org/publicdomain/zero/1.0/legalcode
- Download metadata: Powered by [Poly Haven](https://polyhaven.com/), using its public API for these six selected downloads. There is no live API dependency in the app.

## Verification

Material archives passed ZIP CRC checks. Poly Haven downloads matched the official API's file sizes and MD5 hashes. All included files have SHA-256 hashes; glTF buffer/image references resolve locally and buffer lengths match. JPGs were decoded to check for corruption. This verifies file integrity and packaging, not visual appearance, GPU performance, real-world dimensions or photometric accuracy.

Exhibition GLB headers, embedded buffers and file hashes were checked. Bounds are measured from the imported geometry in metres (width X, depth Z, height Y in glTF). Modular partitions remain separate objects when composing a booth; the collection contains no downloaded complete shell-scheme booth.
