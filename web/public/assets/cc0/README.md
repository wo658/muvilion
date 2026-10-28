# Downloaded CC0 assets

Downloaded 2026-10-28: six ambientCG PBR materials and six Poly Haven models at 1K. These are actual local files, not remote placeholders. See [manifest.json](manifest.json) for each file's local path, original URL, byte length and SHA-256.

## Use

Next.js serves this directory at `/assets/cc0/`. A model entrypoint is `/assets/cc0/models/modern_arm_chair_01/modern_arm_chair_01_1k.gltf`; retain its sibling BIN file and textures directory. Load model entrypoints from the manifest. Material JPG paths are listed under each material's files. No GLB conversion, mesh simplification or image recompression was performed.

Only Color, NormalGL, Roughness, Metalness and AmbientOcclusion JPGs present in the material archives are retained. Original ZIPs, Blender scenes, displacement, NormalDX and preview images are omitted to avoid duplicate storage. This is a static asset inventory, not a user-facing example catalog. The editor does not yet expose these assets in its controls, and no rendering or lighting simulation is claimed.

## Provenance and license

- ambientCG: https://docs.ambientcg.com/license/ — CC0 1.0, including commercial use and redistribution. Source ZIP hashes are in the manifest.
- Poly Haven: https://polyhaven.com/license — CC0 assets, including commercial use and redistribution. Website text, logos and preview renders are not bundled.
- CC0 legal text: https://creativecommons.org/publicdomain/zero/1.0/legalcode
- Download metadata: Powered by [Poly Haven](https://polyhaven.com/), using its public API for these six selected downloads. There is no live API dependency in the app.

## Verification

Material archives passed ZIP CRC checks. Poly Haven downloads matched the official API's file sizes and MD5 hashes. All included files have SHA-256 hashes; glTF buffer/image references resolve locally and buffer lengths match. JPGs were decoded to check for corruption. This verifies file integrity and packaging, not visual appearance, GPU performance, real-world dimensions or photometric accuracy.
