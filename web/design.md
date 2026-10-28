# Muse interface

Muse is the starting point: one conversation, a quiet composer, and tools revealed when useful.

## Layout and copy

- Before opening a drawing, center the conversation. Use one greeting and at most two optional prompts.
- With a drawing, share the workspace between conversation and canvas. Put conversation first on narrow screens.
- No top bar. Brand, projects, booths and settings live in one sidebar that collapses to an icon rail (collapsed by default; icons only on narrow screens).
- With a drawing, Muse is a full-height right sidebar (like the ElevenLabs agent panel) that collapses to a round launcher at the bottom right (like Channel Talk): avatar and status pill over the feed, plain-text replies, ink user bubbles and a bordered composer. On phones it is a bottom sheet.
- Keep sources and application settings in dialogs. Reveal preparation under Drawing settings; Muse starts analysis from chat requests.
- Remove marketing subtitles, decorative workflow steps, duplicate status copy and implementation details. Preserve actionable errors, scale warnings, review coverage and explicit proposal approval.
- Send is conversational. Draft a layout creates a reviewable proposal; Apply changes commits it. Never imply chat itself performed an edit.

## Tokens

`lib/ui/tokens.ts` owns colors. `app/layout.tsx` exposes CSS variables; `app/globals.css` maps them to Tailwind and shadcn semantic roles.

- Neutrals come from one 12-step scale (Radix Colors Slate, light) so every grey shares a hue. Keep each step in its role.
- Surfaces: `bg` (page behind panels), `surface` (sidebars, headers, panels, dialogs), `sunken` (wells, hover), `selected` (current/pressed, under `ink` or `muted` text only). Text: `ink`, `inkSoft`, `muted`; `faint` is for icons and drawing marks, never text.
- Boundaries: `hairline`, `hairlineStrong`, `edge` (outlines in drawings). Prefer subtle borders to heavy shadows.
- Actions: `accent`, `accentHover`, `accentSoft`, `accentInk`. Reserve the blue gradient (`museGlow`) for Muse's avatar.
- Status: `ok`, `bad`, `badSoft`. Overlays and shadows: `overlay`, `shadowColor`.
- Keep the existing font family, 12–14px controls, a restrained 24–32px greeting and 20px dialog/conversation corners.
- UI chrome and the 2D plan must not introduce literal colors; add a named token instead. Exhibition scene materials and the mascot are artwork and may use their own colors. `tests/tokens.test.ts` checks WCAG AA text contrast for token pairs and rejects literal colors elsewhere.
- Respect reduced motion and visible keyboard focus. Dialogs require titles, Escape dismissal, close controls and focus restoration.

## Language

Only `en` (Eng) and `ko` (한국어) are supported. App Settings changes the UI immediately; Korean is the default. The browser stores the preference and synchronizes other tabs. When storage is unavailable, the preference works for the session.

`lib/i18n/en.json` and `ko.json` are the language packs. Both must have matching keys and interpolation parameters. Use `useI18n().t()` in components and `translate()` in pure helpers. Keep full sentences together when numbers or word order differ.

Language changes preserve the conversation, composer, loaded drawing, undo history and selected sources. New Muse requests include the language enum. Historical messages, imported source text, filenames, user labels and external engine diagnostics remain original evidence; never silently rewrite them.

## Verification

Check both languages in the conversation, sources, settings, drawing controls, 2D and 3D views. Verify refresh persistence, keyboard dismissal, mobile overflow and draft preservation. Run the repository's web and engine checks before merging.
