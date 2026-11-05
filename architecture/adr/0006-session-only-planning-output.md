---
status: superseded by ADR-0007
recorded: 2026-11-02
---
# Early planning documents were output as session capture snapshots

In the early production flow, real 3D captures were bundled with the drawing and reference sources of that moment into a one-off printable document. Before a persistent document editing model was added, the snapshot was frozen so captures and input versions would not mix, and browser printing was used instead of a separate PDF server. Captures and the manually entered title and design intent remained only in the panel session.

This record is a past decision describing the early implementation in `c1f172e`. **It is not the storage policy for current planning documents.** It was replaced in `18ceb83` by the persistent per-drawing documents of [ADR-0007](0007-persistent-planning-artifacts.md). Broken links to past files are not kept for the current code.

What was replaced is the session-only document and the manual document fields. Real scene captures, consistency with the drawing/reference sources, and browser PDF printing are kept in the new design. Remaining snapshot helpers do not mean the early session-only UI still exists.
