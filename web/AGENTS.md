# Web agent instructions

The root `AGENTS.md` also applies here.

## Server and browser boundaries

- Keep `app/api/**/route.ts` focused on HTTP parsing, validation, responses, and streaming
  transport. Move model invocation and feature workflows into server feature modules.
- New or migrated server modules belong in `server/` and must use `import "server-only"`
  at runtime entry points. Never import them from client components or browser utilities.
- Keep shared schemas and pure geometry/transformation functions in `lib/`. IndexedDB,
  browser file handling, and view state belong on the browser side, not in `server/`.
- Keep secrets, model configuration, filesystem access, and Python connection configuration
  on the server. Do not expose them through `NEXT_PUBLIC_*` variables.
- Route Python requests through the common engine client. Preserve request cancellation,
  operation-specific timeouts, and response validation when migrating existing calls.
- Model configuration lives in `server/agent`; drawing/model workflows in `server/plans`;
  Python transport in `server/engine`; optional local examples in `server/examples`.
  `lib/engine` retains shared contracts and mock computation, not HTTP transport.
- Unit tests use a test-only `server-only` alias. Next.js compilation must also pass to
  verify that server code is not imported into the client module graph.
- Keep public HTTP request/response shapes and example behavior stable during structural
  moves. Run the relevant tests and the root workflow checks before merging.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
