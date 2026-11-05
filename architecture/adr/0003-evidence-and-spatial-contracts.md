---
status: superseded by ADR-0011
recorded: 2026-11-02
---
# Separate extraction evidence, spatial design and the engine transport contract

Current change: [ADR-0010](0010-retire-layout-engine.md) removes the old computation and [ADR-0011](0011-nextjs-document-preparation.md) replaces the service boundary and drawing contract. What follows is the record of the decision at the time.

Lines detected in a drawing or proposed by a model are not the same as confirmed building structure. Zones and real installations are represented separately on top of a drawing model that preserves source evidence, scale confirmation and classification, and the Python response schema is the source of truth for the engine contract. Automatically connecting the new 3D design to the old flat booth layout contract through a lossy conversion is not adopted.

## Consequences and constraints

- Extracted lines start unclassified and keep the user's confirmation state, such as dimensions and floor boundary. A zone is a non-physical area marking a purpose; an installation is a real spatial element with height and mounting height.
- Physical dimensions in meters are kept distinct from normalized drawing coordinates. Model assets are not arbitrarily scaled down to hide dimension mismatches.
- Hiding ceilings, structure and overhead elements is a display setting. It does not delete them from the saved design, model context or geometry checks.
- After changing `schemas.py` or `plan_schemas.py`, regenerate the OpenAPI/web types and align the web validators. An extension of the web editing model does not mean the engine supports that field.
- The current Studio uses engine extraction (PDFs and images use Muse wall and scale tracing, [ADR-0008](0008-muse-pdf-wall-tracing.md)), and spatial checks for design proposals run in shared web logic. The preserved `/layout` and `/validate` are the old flat contract.
- When extending into a product that needs construction, structural safety, egress compliance or surveyed accuracy, the validation scope and data contract must be redesigned separately.

Evidence: [Python drawing schema](../../engine/app/plan_schemas.py), [Python flat contract](../../engine/app/schemas.py), [web drawing schema](../../web/lib/plans/schema.ts), [dimension rules](../../web/docs/dimensions.md), [engine API description](../../engine/README.md).
