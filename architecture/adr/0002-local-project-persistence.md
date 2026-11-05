---
status: accepted
recorded: 2026-11-02
---
# Local SQLite is the source of truth for projects and assets

If drawings and sources live only in browser storage, original files and edit state are hard to restore or move together. Projects, original/derived assets and app settings are gathered in a local SQLite database managed by Next.js, and project updates check the revision so changes from another tab are not silently overwritten. This is currently a local single-user product, not a storage/authentication design for a multi-organization platform.

## Consequences and constraints

- `projects.state_json` and per-project assets are managed in the same database. Per-drawing planning documents are also part of project state ([0007](0007-persistent-planning-artifacts.md)).
- A project has multiple drawings and shared reference sources. Only the current drawing is sent to Muse as spatial context, and all attached reference sources are included. The old selection flag is compatibility data, not an exclusion switch.
- Old browser data is removed after the server accepts the recovery project. Do not add localStorage/IndexedDB as a storage target for new projects. Browser preferences such as the language setting are separate.
- Project exports include original assets and exclude API keys. A full database copy is not the same as a project export.
- Stored keys are restricted by server file permissions but are not an encrypted secret store. The storage API's loopback/explicit app origin restriction also does not replace user authentication for a public service.
- If remote collaboration, per-user permissions or concurrent-write scale is required, decide the authentication and storage boundaries again together.

Evidence: [database](../../web/server/database.ts), [project storage service](../../web/server/projects/store.ts), [project schema](../../web/lib/projects/schema.ts), [access restriction](../../web/server/settings/meta-key.ts), [drawing sources document](../../web/docs/project-sources.md). Related history: `0c1835b`, `8ec4015`.
