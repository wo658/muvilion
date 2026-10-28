# Muse interface

Muse is the starting point: one conversation, a quiet composer, and tools revealed when useful.

## Layout and copy

- Before opening a drawing, center the conversation. Use one greeting and at most two optional prompts.
- With a drawing, share the workspace between conversation and canvas. Put conversation first on narrow screens.
- Keep sources and application settings in dialogs. Reveal preparation under Drawing settings; Muse starts analysis from chat requests.
- Remove marketing subtitles, decorative workflow steps, duplicate status copy and implementation details. Preserve actionable errors, scale warnings, review coverage and explicit proposal approval.
- Send is conversational. Draft a layout creates a reviewable proposal; Apply changes commits it. Never imply chat itself performed an edit.

## Tokens

`lib/ui/tokens.ts` owns colors. `app/layout.tsx` exposes CSS variables; `app/globals.css` maps them to Tailwind and shadcn semantic roles.

- Surfaces: `bg`, `surface`, `sunken`. Text: `ink`, `inkSoft`, `muted`.
- Boundaries: `hairline`, `hairlineStrong`. Prefer subtle borders to heavy shadows.
- Actions: `accent`, `accentHover`, `accentSoft`, `accentInk`. Reserve the blue gradient (`museGlow`) for Muse's avatar.
- Status: `ok`, `bad`, `badSoft`. Overlays and shadows: `overlay`, `shadowColor`.
- Keep the existing font family, 12–14px controls, a restrained 24–32px greeting and 20px dialog/conversation corners.
- UI chrome must not introduce literal colors. Scene materials, user-chosen object colors and provenance annotations are domain data and may use their own colors.
- Respect reduced motion and visible keyboard focus. Dialogs require titles, Escape dismissal, close controls and focus restoration.

## Language

Only `en` (Eng) and `ko` (한국어) are supported. App Settings changes the UI immediately; Korean is the default. The browser stores the preference and synchronizes other tabs. When storage is unavailable, the preference works for the session.

`lib/i18n/en.json` and `ko.json` are the language packs. Both must have matching keys and interpolation parameters. Use `useI18n().t()` in components and `translate()` in pure helpers. Keep full sentences together when numbers or word order differ.

Language changes preserve the conversation, composer, loaded drawing, undo history and selected sources. New Muse requests include the language enum. Historical messages, imported source text, filenames, user labels and external engine diagnostics remain original evidence; never silently rewrite them.

## Verification

Check both languages in the conversation, sources, settings, drawing controls, 2D and 3D views. Verify refresh persistence, keyboard dismissal, mobile overflow and draft preservation. Run the repository's web and engine checks before merging.
