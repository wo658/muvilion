---
status: accepted
recorded: 2026-11-02
---
# Remove the old layout optimization and circulation calculation

The current Studio proposes spatial designs through Meta Model editing tool calls and image review,
and the old Python `/layout` and `/validate` are not connected to this flow. Remove the unused
OR-Tools solver, Shapely validation and circulation calculation, cache, web mock and flat contract.
This supersedes ADR-0001's decision to keep the computation service and ADR-0003's decision to preserve the old flat contract.
Separation of source evidence and edit state, user Apply, and the web's existing input checks are kept.

PDF, image and DXF processing still depends on Python. After integrating the model-based drawing reading
in progress in other work and moving page rendering, the whole server will be removed.
Until that step is complete, do not describe Next.js as able to run on its own.
Layout proposals do not mean optimal solutions or validated egress/circulation simulation results.

Follow-up: [ADR-0011](0011-nextjs-document-preparation.md) moved document preparation and completed the removal of the Python server.
