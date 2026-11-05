# Architecture and Decision Records

As of: 2026-11-02 KST. This document describes the current structure. The background of individual choices and how they replace one another are recorded in the [ADR index](adr/README.md).

## Current structure

| Boundary | Responsibility and source of truth |
| --- | --- |
| Browser | Drawing editing, 3D display, real scene captures, planning document preview and printing. Spatial changes are applied with Apply after reviewing a proposal |
| Next.js | Browser APIs, Muse model calls ([ADR-0009](adr/0009-muse-model-workflows.md)) and work orchestration, storage of projects, original assets and settings. Server features live in `web/server/` |
| Document preparation | A request-scoped Node worker in Next.js renders PDF/image previews. No local OCR or line extraction ([ADR-0011](adr/0011-nextjs-document-preparation.md)) |
| SQLite | Projects, original/derived assets, per-drawing planning documents, app settings. Keys are excluded from regular project exports |
| Drawing contract | `web/lib/plans/schema.ts` owns runtime validation for edits, saves and model results |
| PDF | Derived output for reading a saved planning document. The editable source of truth is the project's planning document |

Browser requests go through Next.js. Meta Model reads drawing images and proposes spatial designs. The Python server, the old `/layout` and `/validate`, and circulation calculations have been removed. Document workers are discarded when the request ends; they are not a separate server or a durable job queue. In-progress proposals and captures are also kept distinct from saved project state.

## Where to look

- [AGENTS.md](../AGENTS.md), [web rules](../web/AGENTS.md): boundaries and verification steps to follow when working.
- [ADR index](adr/README.md): reasons for decisions, constraints to keep, superseded decisions.
- [Glossary](../GLOSSARY.md): meaning of drawing, spatial design, planning document and booth.
- [Web setup and features](../web/README.md): usage and the current API.
- [UI specification](../web/design.md): interface, language, color and output rules.
- [Drawing source management](../web/docs/project-sources.md), [dimension rules](../web/docs/dimensions.md), [Designer Muse tools](../web/documentation/designer-muse-tools.md): detailed per-feature contracts.

The root `README.md` is the public overview; `docs/` holds private local plans and is not tracked in Git. Public documents do not depend on that path existing. Early research and proposals are not used as-is to describe the current implementation. The product scope/platform plans in them are future plans; only the current decisions that are needed are moved into ADRs.

## Update rules

When changing a choice that is costly to change, such as roles, data ownership, storage or contracts, include the ADR in the same change as the code. When reversing an existing decision, add a new ADR and record the supersession in the old document. Simple wording corrections and evidence link updates are made in the existing ADR. Record UI details in `web/design.md` and task lists in planning documents, so ADRs do not grow into feature lists.

An ADR records a decision; it does not prove that tests pass. Verification is confirmed by each change's tests, commits and Redpact run records. When a document and the code disagree, state the difference, confirm which reflects current behavior, and then fix it.
