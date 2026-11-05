---
status: accepted
recorded: 2026-11-03
---
# Wall designs are stored as surface designs separate from wall evidence

Spatial design includes finishes, copy and graphics on existing walls and partitions. Representing them by rewriting source wall lines or by creating separate installations that overlap walls would change the evidence or trip collision checks. `PlanDocument.wallSurfaces` is added as an optional design collection that references an existing wall line ID or partition installation ID and a face side. Existing documents are read as-is without this collection.

A surface is a zero-thickness representation limited to a span within the host's width and a height. It stores color, catalog material, copy and stripe/frame, and does not include arbitrary images, logo reconstruction, three-dimensional attachments or construction suitability. It is not counted in physical furniture counts or floor coverage, and is linked separately to wall requirements. Installations with real thickness use the existing installation contract and collision checks.

Additions, edits and deletions are delivered through the ADR-0013 operation path and are included in undo, SQLite and exports. Deleting a host must be in the same batch as deleting its surfaces, and invalid references or exceeding the host height are rejected before applying. Saved documents whose references disappeared, for example through reclassification of walls in past data, are read but floating finishes are not rendered. Crop resets surfaces together with existing installations. Source walls, scale and outlines are not modified.
