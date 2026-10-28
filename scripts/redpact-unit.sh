#!/bin/sh
# Run both existing suites and preserve failure if either suite fails.
status=0
(cd /workspace/engine && uv run --no-sync pytest) || status=1
(cd /workspace/web && pnpm test) || status=1
exit "$status"
