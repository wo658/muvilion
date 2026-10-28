#!/bin/sh
# Run every required repository check and preserve any failure.
status=0
(cd /workspace/engine && uv run --no-sync pytest) || status=1
(cd /workspace/engine && uv run --no-sync ruff check .) || status=1
(cd /workspace/web && pnpm test) || status=1
(cd /workspace/web && pnpm typecheck) || status=1
(cd /workspace/web && pnpm lint) || status=1
exit "$status"
