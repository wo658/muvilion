# Vercel AI Elements

Copyright 2023 Vercel, Inc. Apache-2.0, verified 2026-10-29.
Source: https://github.com/vercel/ai-elements
Registry snapshots: https://registry.ai-sdk.dev/conversation.json,
https://registry.ai-sdk.dev/message.json, https://registry.ai-sdk.dev/prompt-input.json.

These are adapted subsets of the official components. Unused branching, file
uploads, model menus and speech controls are omitted. Muse keeps its existing
Sources dialog, controlled draft, intent routing and proposal approval flow.
Local adaptations: token colors, instant scrolling (including reduced motion),
localized labels supplied by callers, Korean IME keyCode 229 guard, and normal
React memo comparison so streaming state changes are not ignored.

Markdown links use sanitized ordinary anchors instead of the optional Streamdown
confirmation modal. Image fallback text comes from the app language packs.
