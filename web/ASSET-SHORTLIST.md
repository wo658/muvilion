# CC0 asset shortlist for spatial design

Checked and downloaded: 2026-10-28. The **actual 1K files for the initial 12 selections are included in `public/assets/cc0/`**. For materials, web JPG maps were extracted; models were stored as glTF + BIN + referenced textures. Use the 2K links below to fetch higher-resolution originals. The local file list, sources and checksums are recorded in [manifest.json](public/assets/cc0/manifest.json), and usage and verification scope in the [asset guide](public/assets/cc0/README.md). Muse can search them with its `search_design_assets` tool and include them in design proposals. When the user applies a proposal, the 3D scene loads the models and materials. Real Muse responses and scene rendering have been checked; there is no separate manual asset-picker UI.

## Additional exhibition downloads — 2026-10-29

Added 9 exhibition GLBs for 21 in total. The additional original files total **236,488 bytes (about 231 KiB)** and are all included in the local repository. The original GLBs were not converted and have no external texture dependencies. The supplier labels each model **CC0 1.0 and AI-generated**. They are for concept visualization, not manufacturer products or construction drawings; app dimensions are measured from the bounds of the downloaded meshes.

| Use | Official asset page | Downloaded GLB |
| --- | --- | --- |
| Modular partition wall (`gallery_wall`) | [Source](https://3dassets.dev/assets/art-gallery-and-exhibition-rooms-gallery-wall-module-744f878b) | [Download](https://cdn.3dassets.dev/assets/35815/v1/model.glb) |
| Movable partition (`movable_partition`) | [Source](https://3dassets.dev/assets/art-gallery-and-exhibition-rooms-movable-partition-wal-1b35e01f) | [Download](https://cdn.3dassets.dev/assets/35819/v1/model.glb) |
| Display plinth (`display_plinth`) | [Source](https://3dassets.dev/assets/art-gallery-and-exhibition-rooms-display-plinth-58fbcf1d) | [Download](https://cdn.3dassets.dev/assets/35842/v1/model.glb) |
| Glass vitrine (`display_vitrine`) | [Source](https://3dassets.dev/assets/art-gallery-and-exhibition-rooms-vitrine-case-ca6b50af) | [Download](https://cdn.3dassets.dev/assets/35846/v1/model.glb) |
| Reception desk (`reception_desk`) | [Source](https://3dassets.dev/assets/art-gallery-and-exhibition-rooms-reception-desk-0494fe21) | [Download](https://cdn.3dassets.dev/assets/35854/v1/model.glb) |
| Information board (`floor_plan_board`) | [Source](https://3dassets.dev/assets/art-gallery-and-exhibition-rooms-floor-plan-board-4f776135) | [Download](https://cdn.3dassets.dev/assets/35863/v1/model.glb) |
| Track spotlight (`track_spot`) | [Source](https://3dassets.dev/assets/art-gallery-and-exhibition-rooms-track-spot-head-44353656) | [Download](https://cdn.3dassets.dev/assets/35824/v1/model.glb) |
| Horizontal truss (`truss_horizontal`) | [Source](https://3dassets.dev/assets/live-music-venue-and-festival-stage-truss-straight-bay-3e0706d1) | [Download](https://cdn.3dassets.dev/assets/33888/v1/model.glb) |
| Vertical truss (`truss_vertical`) | [Source](https://3dassets.dev/assets/live-music-venue-and-festival-stage-truss-vertical-tow-8ea841b9) | [Download](https://cdn.3dassets.dev/assets/33891/v1/model.glb) |

Muse can find them by searching `partition`, `booth`, `vitrine`, `board` or `truss`. Partitions are `partition`, and information boards and trusses are `equipment`, distinct from the existing furniture and lights.

**Booth composition:** this download has no complete pre-assembled booth. Place modular partitions as individual objects, leave the front entrance open, then add reception and display fixtures. Do not replace a whole booth with one solid collision box. Original proportions are kept, so these are not construction panels that stretch non-uniformly to arbitrary widths and heights. When precise dimension control is needed, use the existing schematic partitions and finish materials. Truss loads and joints, light distribution and egress widths are not verified by these visualization assets.

## Materials — 6 from ambientCG

The ZIPs below are the official pages' **2K-JPG** download links. For lightweight initial checks you may choose 1K-JPG on the page instead. The 1K ZIPs actually received were CRC-checked and only the needed maps extracted. The 2K files were not separately received. If a link changes, download again from the individual page.

| Asset / official page | Where it is used in the app and why | Download | Notes when choosing |
| --- | --- | --- | --- |
| [Plaster 001](https://ambientcg.com/view?id=Plaster001) | White partitions and exhibit backdrops. Matte white plaster texture | [2K JPG ZIP](https://ambientcg.com/get?file=Plaster001_2K-JPG.zip) | A rough, stucco-like surface. Smooth painted partitions default to a solid material, with this as an option |
| [Concrete 034](https://ambientcg.com/view?id=Concrete034) | Venue floors and existing walls. Smooth light-grey concrete | [2K JPG ZIP](https://ambientcg.com/get?file=Concrete034_2K-JPG.zip) | Supplier tile area about 1.1m × 0.55m. Match UV repeat size to real dimensions |
| [Wood 051](https://ambientcg.com/view?id=Wood051) | Display stands, counters and furniture. Dark, smooth wood | [2K JPG ZIP](https://ambientcg.com/get?file=Wood051_2K-JPG.zip) | Supplier tile area about 0.8m × 0.8m. Do not use it to represent light plywood |
| [Metal 036](https://ambientcg.com/view?id=Metal036) | Partition frames, furniture legs and light housings. Grey metal | [2K JPG ZIP](https://ambientcg.com/get?file=Metal036_2K-JPG.zip) | The metallic look also depends on ambient light and roughness settings; check in the app |
| [Fabric 026](https://ambientcg.com/view?id=Fabric026) | Event feature areas and carpeted floors. Red fabric/carpet | [2K JPG ZIP](https://ambientcg.com/get?file=Fabric026_2K-JPG.zip) | A red carpet option, not a neutral fabric. Do not apply it wholesale as the default floor |
| [Tiles 074](https://ambientcg.com/view?id=Tiles074) | Marble tile floors for lobbies and lounges | [2K JPG ZIP](https://ambientcg.com/get?file=Tiles074_2K-JPG.zip) | Supplier tile area about 2.1m × 2.1m. Preserve the grout-line scale |

Supplier/rights basis: [ambientCG official license](https://docs.ambientcg.com/license/). Downloaded assets and material preview renders are CC0 1.0, permitting commercial use, modification, redistribution and inclusion of original files in projects. Attribution is not required, but asset IDs and sources are kept for traceability.

## Furniture — 3 from Poly Haven

The links below are **individual asset download pages**, not direct ZIP links. On the page choose **1K or 2K → glTF → Download**. The current local version is 1K glTF and includes all BIN and referenced texture files. No GLB conversion was done.

| Asset / download page | Where it is used in the app and why | Supplier-listed complexity / dimensions | Adoption priority |
| --- | --- | --- | --- |
| [Modern Arm Chair 01](https://polyhaven.com/a/modern_arm_chair_01) | Consultation and lounge seating. Modern armchair with a wood frame and black cushions | About 9K triangles / 1m high | First: verify as a small lounge set with the table |
| [Modern Coffee Table 01](https://polyhaven.com/a/modern_coffee_table_01) | Lounge table. Stone top and wood frame | About 5K triangles / 1.2m wide | First: check the top texture and floor anchor point |
| [Modular Street Seating](https://polyhaven.com/a/modular_street_seating) | Shared rest areas and waiting benches. Modular seating | About 25K triangles / 4.3m overall width | Next: dimensions are for the whole set, so do not register it as a single chair. Public/outdoor style rather than interior furniture |

## Lighting — 3 from Poly Haven

Downloading works as for furniture. Lighting assets are **fixture appearance candidates**. Keep emissive materials, actual scene light sources and light distribution/illuminance calculations distinct. The list below includes no IES photometric data or lighting simulation validation.

| Asset / download page | Where it is used in the app and why | Supplier-listed complexity / dimensions | Adoption priority |
| --- | --- | --- | --- |
| [Modern Ceiling Lamp 01](https://polyhaven.com/a/modern_ceiling_lamp_01) | Spherical pendant for lounge and consultation areas. White translucent glass with metal fittings | About 6K triangles / 1m high | First: set the ceiling attachment point and light position separately |
| [Mounted Fluorescent Lights](https://polyhaven.com/a/mounted_fluorescent_lights) | Linear lighting for halls and work areas. Grey metal housing with an emission map | About 18K triangles / 0.9m wide | Next: when repeated, manage model duplication cost and actual light count separately |
| [Desk Lamp Arm 01](https://polyhaven.com/a/desk_lamp_arm_01) | Articulated lamp for reception and demo desks | About 26K triangles / 0.9m high | Secondary: complex for a small prop, so use selectively on tables seen up close |

Complexity and dimensions are rounded values from the official pages, not performance or collision dimensions measured in the app. Available formats include glTF, Blend, USD and FBX; the glTF path is recommended for this app.

Supplier/rights basis: [Poly Haven official license](https://polyhaven.com/license). Assets are CC0, permitting commercial use, modification and redistribution. The site's text, logos and example renders are not treated as CC0 wholesale. Rendering app thumbnails directly from the received models is recommended. Website/API access terms are separate from the asset license, so bulk collection and live API integration are not part of this selection.

## Notes on applying the initial collection

1. Verify Concrete 034 + Wood 051 + Modern Arm Chair 01 + Modern Coffee Table 01 + Modern Ceiling Lamp 01 as the first photorealistic lounge combination. Dimension-adjustable default partitions use a solid finish or Plaster 001. The GLB partitions added here are a separate option that keeps original proportions.
2. The initial Poly Haven glTF packages keep textures and meshes together. The additional exhibition assets are already supplied as GLB. Check metre units, orientation, floor/ceiling attachment anchors, material slots and bounding boxes. Keep existing layout/collision data distinct from decorative models.
3. For materials, apply Base Color / Normal GL / Roughness first and add Metalness and AO when needed. Displacement is not applied by default in the initial web viewer. The currently included map set can be checked in manifest.json.
4. Repeated chairs and lights share resources; verify in real scenes starting at 1K–2K. Check transparent glass and shadow cost separately. The triangle counts above alone do not guarantee performance.
5. The supplier ID, original page, download URL, download date, license basis and SHA-256 of each included file are recorded in manifest.json. Original bytes are kept, with no conversion other than selective map extraction. This document is a shortlist and does not replace a user-facing example catalog or a runtime asset registry.

Partitions that need precise dimension editing continue to use schematic geometry. External models supply a variety of decorative forms, while simple shapes whose core needs are dimension editing and repeated placement are better managed in the app.
