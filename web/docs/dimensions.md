# Dimension conventions

## Coordinates and drawings

- 1 scene unit = 1 m. Drawing x/y are 0..1 from the top-left; metre coordinates are x × widthMeters and y × heightMeters.
- Object width/depth/height are the X/Z/Y outer dimensions before rotation. A 90° rotation changes only the orientation; the dimension fields are not swapped.
- Re-check the scale after cropping. Do not apply hall dimensions to the whole image including the legend. Raster drawings may be distorted per axis, so prefer checking known overall horizontal and vertical dimensions.
- In the KINTEX Hall 1 original, 1B is labelled 90 × 63 m. Apply this dimension only after cropping to the 1B area. This is an approximate calibration based on the printed drawing, not a site survey.
- Boundaries, columns, entrances and ceiling heights must be checked separately. Event areas and aisles are not facts determined automatically from the drawing scale.

## Object conventions (m)

| Schematic fixture | Width | Depth | Overall height | Use |
|---|---:|---:|---:|---|
| work-table | 1.20 | 0.60 | 0.74 | Seated editing and consultation |
| meeting-table | 1.40 | 0.80 | 0.74 | Four-person conversation |
| event-chair | 0.50 | 0.55 | 0.85 | Seat height 0.45 |
| phone-stand | 0.60 | 0.60 | 1.60 | Floor base, pole and phone clamp |
| studio-light | 0.60 | 0.60 | 2.10 | Schematic base, pole and softbox |
| lounge-sofa | 1.80 | 0.80 | 0.85 | Two-person lounge seating |

These values are explicit design assumptions of this app. They are not measurements of specific products or ergonomic or safety certification values. The canonical source is `lib/assets/fixtures.ts`, shared by the API tools and the 3D meshes.

Imported glTF models use the catalog's native dimensions as is. Catalog values are outer sizes with the file's scene transforms applied, not product measurements. Input rounding within 5 mm is normalized to the native dimensions. Larger differences make a new proposal be rejected, with guidance to use rotation, additional modules or a custom schematic shape. Existing invalid models are shown as boxes of their stored outer size with a warning.

## Verification and limits

The on-screen mesh bounds, the floor plan and the rotated bounding boxes used for collision checks share the same metre dimensions. The collision check is a conservative bounding-box check that also occupies the empty space between furniture legs; it is not precise mesh collision or code/egress verification. Matching bounds do not automatically guarantee seating use or layout quality. Minimum aisles, clearances and real product specifications are reviewed separately.

## Instagram/Threads regeneration check (2026-10-31)

1B was calibrated to 90 × 63 m and a central 40 × 30 m event area was saved as the design basis first, then the design was regenerated with real model calls. After applying, the project was reopened and 68 installations and 8 areas were confirmed. These include 2 consultation tables, 4 conversation tables, 44 chairs, 3 each of lights and phone stands, and 2 sofas. Saved-document checks found 0 native-dimension mismatches, 0 geometric collision warnings and 0 event-area escapes.

Automated verification checks the mesh bounds and rotated collision extents of the 6 schematic fixtures and the post-scene-transform vertices of 15 real glTF files. Incorrect catalog records for vitrine height and depth were also corrected from the files. 514 web tests, type checking and lint, plus 53 engine tests and Ruff, passed. These results do not replace a site survey or egress/construction verification.

## Seating and movement review

Objects not overlapping is different from people being able to use them. New generations must pass `reviewUsability` before submission. `event-chair` and `lounge-sofa` name the table or stage they are used with via `useTargetId`, and their front direction is 0° north / 90° east / 180° south / 270° west. Object rotation supports four directions; zone rotation keeps the existing 0°/90°. The floor plan and generation review images also show the front direction of seats.

The app's schematic design assumptions:

- 0.10–0.35m between work/conversation tables and chair fronts; 0.35–0.60m between sofas and coffee tables.
- 0.75m of movement space behind chairs, 0.45m of legroom in front of audience seats, and 0.35m of use space in front of sofas. Use spaces must not overlap objects, walls or main aisles.
- Declared main aisles at least 1.20m wide. Aisle areas must form one connected interior route.
- A straight 1.20m-wide approach from behind table seats and from the front sides of sofas to an aisle, and 0.90m from behind audience seats, is checked. If a turning approach is needed, add a connecting branch-aisle area. The check reuses the existing walking geometry's wall thickness, bounds and installations with a conservative sampling margin.
- Audience seating is recommended at a row pitch of at least 1.60m for 0.55m-deep chairs. Gaps between seats alone do not substitute for a main aisle.

These values are explicit app design assumptions, not legal standards. The [US Access Board guide to accessible routes](https://www.access-board.gov/ada/guides/chapter-4-accessible-routes/) likewise treats continuous clear route width and turning/passing space separately. This check does not cover egress to actual exits, wheelchair seating or turning space, stage access for people with reduced mobility, crowds and queues, slopes and floor finishes, or sightlines blocked by heads. If entrances are not confirmed, describe only the interior route connection as checked. Do not claim ergonomic certification from model furniture appearance alone.

### Instagram/Threads usability re-check (2026-10-31)

The existing 68 installations were rearranged with real model calls. The full request hit the 7-minute limit, and the remaining review was completed from the unsaved draft that had been obtained. The total limit for generations with more review iterations was raised to 10 minutes, with the HTTP execution limit adjusted to match. The final proposal fixed front-row legroom that had failed the check and was not saved, and added two schematic steps 0.15/0.30m high to the 0.45m-high stage. The stage steps are a design element representing going up and down; the viewer's level-ground walking does not simulate walking on stairs.

The final saved version has 70 installations and 12 zones, with 44 chairs and 2 two-person sofas. All 46 seating objects passed use target, orientation, spacing and aisle connection checks. Confirmed: table front gaps of about 0.20m, sofa front gaps of about 0.40m, audience row pitch 1.60m, at least 0.475m between the stage and front-row chairs, a 3m main aisle and 1.2–1.5m branch aisles. There were 0 dimension mismatches, object collisions, event-area escapes and usability issues. The real app's plan and eye-level views, floor-click movement, and reload after saving were checked. "Connected" in this result does not mean egress verification to confirmed actual exits.
