# Muse interface

Muse is the starting point: one conversation, a quiet composer, and tools revealed when useful.

## Layout and copy

- Before opening a drawing, center the conversation. Use one greeting and at most two optional prompts.
- With a drawing, share the workspace between conversation and canvas. Put conversation first on narrow screens.
- No top bar. Brand, projects, booths and settings live in one sidebar that collapses to an icon rail (collapsed by default; icons only on narrow screens).
- With a drawing, Muse is a full-height right sidebar (like the ElevenLabs agent panel) that collapses to a round launcher at the bottom right (like Channel Talk): avatar and status pill over the feed, streaming Markdown replies, ink user bubbles and a bordered composer. On phones it is a bottom sheet.
- The drawing workspace is 3D. There is no 2D/3D switch: the 2D plan appears only while a setup tool needs it (Drawing settings, crop, scale, floor outline, entrance, wall drawing) and returns to 3D when the tool closes.
- The workspace header contains mode, a labelled drawing selector, one Project settings icon, the Overview / Top / Explore views, and one View settings icon. Switch drawings directly without opening source management; include PDF page numbers in drawing labels and reset the camera when changing drawings. Project settings groups Sources and Booth pricing · applications in one dialog. App Settings stays separate. View settings groups cutaway, ceiling/layers, Muvi pause/hide, camera reset, and collapsed help; no standalone focus, reset, mascot or help buttons in the header.
- Sources holds up to 12 drawing sources per project. Adding a drawing preserves existing drawings; Open drawing changes the active workspace. Each drawing retains its saved geometry, scale and design edits across switches and reloads. PDF pages opened from Drawing settings are separate drawing sources and reopen their saved edits. Only the active drawing is supplied to Muse; reference materials remain shared. Undo history and unfinished dimension inputs survive switches within the session.
- Muse's header shows only the avatar, plus a status pill while Muse is replying; no role label. The 3D view has no floating legend or Muvi caption.
- Interior design is Muse’s primary workflow: brand references, temporary partitions, furnished booths and visitor experience. Existing-wall analysis is optional and starts only from explicit chat requests. Keep scale/floor preparation under Drawing settings.
- Proposals show the model-authored brand direction and requested deliverables linked to actual elements, separately from geometry warnings. Counts verify presence, not aesthetic quality. Never label a zone-only footprint or a concept image as a furnished interior. Apply remains explicit.
- Planned schematic partition faces use their saved design color so the proposed brand palette is visible in 3D; selection and edge markers retain semantic tokens. Asset models keep authored materials.
- Remove marketing subtitles, decorative workflow steps, duplicate status copy and implementation details. Preserve actionable errors, scale warnings, review coverage and explicit proposal approval.
- Send is conversational. Draft a layout creates a reviewable proposal; Apply changes commits it. Never imply chat itself performed an edit.

- While Muse designs, grouped installation edits and review corrections appear in the same 3D/2D viewport with “Live draft · not saved”. This ephemeral overlay never enters project persistence or undo history. Apply commits only the final reviewed proposal. Cancel, failures, changed drawing/references and unmount discard the preview; camera navigation stays available.

- Editing is conversational: no manual editing menu in the workspace header and no immediate Delete action in the selection card. Keep canvas selection, the selected-element context card, Clear selection and Ask about this. Send selected IDs and labels to intent routing, conversation and design requests; changes remain reviewed proposals. Do not show a standalone Confirm scale button in the conversation. Keep manual scale calibration in Drawing settings.

- The sample picker lists venue projects, showing included drawing names and counts. Creating a sample copies all originals and extracts the listed PDF pages into separate drawings before opening; do not create partial projects on extraction failure or silently omit missing files. The header immediately switches among the included drawings. Existing user projects are not regrouped.

- The sidebar lists projects, not legacy sample drawings. Explicitly consolidated sample projects appear once; old links open the corresponding drawing in the retained project. Preserve the old rows and originals for recovery, and reject writes from stale tabs until they reload. Independently designed projects remain separate even when they share a venue.

## Tokens

`lib/ui/tokens.ts` owns colors. `app/layout.tsx` exposes CSS variables; `app/globals.css` maps them to Tailwind and shadcn semantic roles.

- Neutrals come from one 12-step scale (Radix Colors Slate, light) so every grey shares a hue. Keep each step in its role.
- Surfaces: `bg` (page behind panels), `surface` (sidebars, headers, panels, dialogs), `sunken` (wells, hover), `selected` (current/pressed, under `ink` or `muted` text only). Text: `ink`, `inkSoft`, `muted`; `faint` is for icons and drawing marks, never text.
- Boundaries: `hairline`, `hairlineStrong`, `edge` (outlines in drawings). Prefer subtle borders to heavy shadows.
- Actions: `accent`, `accentHover`, `accentSoft`, `accentInk`. Reserve the blue gradient (`museGlow`) for Muse's avatar.
- Status: `ok`, `bad`, `badSoft`. Overlays and shadows: `overlay`, `shadowColor`.
- Keep the existing font family, 12–14px controls, a restrained 24–32px greeting and 20px dialog/conversation corners.
- UI chrome and the 2D plan must not introduce literal colors; add a named token instead. Exhibition scene materials and the mascot are artwork and may use their own colors. `tests/tokens.test.ts` checks WCAG AA text contrast for token pairs and rejects literal colors elsewhere.
- Adding a color: name it by role in `lib/ui/tokens.ts` (camelCase; it becomes `--kebab-case`). If Tailwind classes need it, map it in the `@theme` block of `app/globals.css`. Add any new text/background pair to the contrast list in `tests/tokens.test.ts`. Remove tokens that are no longer used.
- shadcn components keep their semantic names (`primary`, `secondary`, `border`, `input`, `ring`, `destructive`), which `globals.css` aliases to Muse tokens. shadcn's `accent`/`muted` mean something else here: use `sunken`/`selected` for hover and selection backgrounds, never `bg-accent` or `bg-muted`.
- Respect reduced motion and visible keyboard focus. Dialogs require titles, Escape dismissal, close controls and focus restoration.

## Muvi mascot

Keep the rounded M silhouette, periwinkle body and dark eyes consistent across 2D and 3D. Muvi has no cheek blush; apply this to avatars, icons and the 3D model.

## Language

Only `en` (Eng) and `ko` (한국어) are supported. App Settings changes the UI immediately; Korean is the default. The browser stores the preference and synchronizes other tabs. When storage is unavailable, the preference works for the session.

`lib/i18n/en.json` and `ko.json` are the language packs. Both must have matching keys and interpolation parameters. Use `useI18n().t()` in components and `translate()` in pure helpers. Keep full sentences together when numbers or word order differ.

Language changes preserve the conversation, composer, loaded drawing, undo history and selected sources. New Muse requests include the language enum. Historical messages, imported source text, filenames, user labels and external engine diagnostics remain original evidence; never silently rewrite them.

## Verification

Check both languages in the conversation, sources, settings, drawing controls, 2D and 3D views. Verify refresh persistence, keyboard dismissal, mobile overflow and draft preservation. Run the repository's web and engine checks before merging.

## Chat components

Muse uses adapted Vercel AI Elements Conversation, Message/MessageResponse and
PromptInput components under `components/ai-elements` (source and license there).
Conversation follows new messages until the reader scrolls away; a localized
button returns to the latest message. Scrolling is instant, including reduced motion.
Assistant Markdown uses Streamdown; user input remains literal text. Sources,
automatic intent routing, bilingual labels, cancellation and explicit proposal
approval remain owned by StudioChat. File attachments remain in the Sources dialog.
