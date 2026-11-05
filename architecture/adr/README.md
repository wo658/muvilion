# Architecture Decision Records

The root `docs/` path is private and gitignored, so ADRs live in `architecture/adr/`, which is tracked in Git. [Documentation overview](../README.md).

This record date is **2026-11-02 KST**. Existing decisions were written up retroactively from the current code, rules and Git history. Numbers reflect the order of writing, not the order in which decisions were actually made. Original decision dates are not estimated, and the reasons below rest on stated rules and implementation constraints. They do not imply that separate comparative experiments or customer validation were carried out.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-service-boundaries.md) | Next.js owns the app and model work; Python owns computation | superseded by ADR-0011 |
| [0002](0002-local-project-persistence.md) | Local SQLite is the source of truth for projects and assets | accepted |
| [0003](0003-evidence-and-spatial-contracts.md) | Separate source evidence, the spatial editing model and the engine contract | superseded by ADR-0011 |
| [0004](0004-reviewed-design-proposals.md) | Request-scoped model work and explicit application of spatial changes | superseded by ADR-0013 for design; line review still applies |
| [0005](0005-design-studio-scope.md) | Keep a single production flow; defer the participant platform | accepted |
| [0006](0006-session-only-planning-output.md) | One-off planning document output from session captures | superseded by ADR-0007 |
| [0007](0007-persistent-planning-artifacts.md) | Persistent per-drawing planning documents with derived PDF output | accepted |
| [0008](0008-muse-pdf-wall-tracing.md) | Muse finds drawing walls and scale evidence in images | accepted, amended by ADR-0011, ADR-0012 |
| [0009](0009-muse-model-workflows.md) | All model work goes through Muse, bound in a propose-validate-apply loop | accepted |
| [0010](0010-retire-layout-engine.md) | Remove the old layout optimization, validation and circulation calculation | accepted |
| [0011](0011-nextjs-document-preparation.md) | Remove Python with Next.js document preparation and Meta Model interpretation | accepted, amended by ADR-0012 |
| [0012](0012-muse-scale-floor-auto-design.md) | Muse sets scale and floor outline and auto-applies the first interior | accepted, amended by ADR-0013 |
| [0013](0013-atomic-muse-operations.md) | Commit Muse work immediately in atomic operations | accepted |

| [0014](0014-wall-surface-designs.md) | Store surface designs for existing walls and partitions separately from evidence | accepted |

## Reading and updating

`accepted` is a currently adopted decision, `proposed` is under review, and `deprecated` is a decision no longer recommended. `superseded by ADR-NNNN` means a replacement document exists. Use the next number for a new decision, and first write the context, choice and reason briefly. Add consequences, constraints, code evidence and revisit conditions when needed.

Do not leave past approaches looking like current recommendations. For example, the statement that the planning document disappears when the panel closes is past behavior from 0006; the current storage/output policy for planning documents is 0007. Align the related READMEs and UI specification in the same change.
