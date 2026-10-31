# Muse interface

Muse is the starting point: one conversation, a quiet composer, and tools revealed when useful.

## Layout and copy

- Before opening a drawing, center the conversation. Use one greeting and at most two optional prompts.
- With a drawing, share the workspace between conversation and canvas. Put conversation first on narrow screens.
- No top bar. Brand, projects, booths and settings live in one sidebar that collapses to an icon rail (collapsed by default; icons only on narrow screens).
- With a drawing, Muse is a full-height right sidebar (like the ElevenLabs agent panel) that collapses to a round launcher at the bottom right (like Channel Talk): avatar and status pill over the feed, streaming Markdown replies, ink user bubbles and a bordered composer. On phones it is a bottom sheet.
- The drawing workspace is 3D. There is no 2D/3D switch: the 2D plan appears only while a setup tool needs it (Drawing settings, crop, scale, floor outline, entrance, wall drawing) and returns to 3D when the tool closes.
- The workspace header contains a labelled drawing selector, one Project settings icon, the Overview / Top / Explore views, and one View settings icon. On phones, wrap drawing selection/project settings and view controls into separate rows so their hit areas never overlap. Switch drawings directly without opening source management; include PDF page numbers in drawing labels and reset the camera when changing drawings. The Project settings icon opens a compact action popover with Drawing settings and Sources. Drawing settings opens the 2D setup panel for scale, crop and floor outline; Sources and booth management open their own titled views with no cross-section navigation inside either dialog. Closing the popover or a dialog restores focus to the persistent workspace trigger. App Settings stays separate. View settings groups cutaway, ceiling/layers, Muvi pause/hide, camera reset, and collapsed help; no standalone focus, reset, mascot or help buttons in the header.
- Sources holds up to 12 drawing sources per project. Adding a drawing preserves existing drawings; Open drawing changes the active workspace. Each drawing retains its saved geometry, scale and design edits across switches and reloads. PDF pages opened from Drawing settings are separate drawing sources and reopen their saved edits. Only the active drawing is supplied to Muse; reference materials remain shared. Undo history and unfinished dimension inputs survive switches within the session.
- Source management is a standalone Sources dialog with no drawing-settings or booth-management tabs: one search and primary Add source row, compact Drawings and References groups, small thumbnails and filenames. Add source opens a compact inline choice of drawing, concept image, brand URL or brief; choosing one closes the chooser. Avoid duplicate titles, instructional subtitles, card outlines, capacity denominators and selection toggles. Use spacing and typography instead of divider lines in the project dialog header, source chooser, brand form, removal confirmation and preview header. Every reference and the active drawing are included in Muse context automatically; legacy selection flags do not hide materials. Keep a plain current-drawing label and show page metadata only for multi-page drawings. Search only filters the visible library. Show a useful empty result and a clear-search action. Reference removal requires an inline Cancel/Remove confirmation. Brand links use an inline URL/name/notes form and explicitly remain bookmarks. Successful addition reveals the new material even when a search was active. Dialog headers remain visible while content scrolls; narrow screens wrap row actions. Preview opens from the filename row and restores focus on dismissal.
- Muse's header shows only the avatar, plus a status pill while Muse is replying; no role label. The 3D view has no floating legend or Muvi caption.
- Interior design is Muse’s primary workflow: brand references, temporary partitions, furnished booths and visitor experience. Existing-wall analysis is optional and starts only from explicit chat requests. Keep scale/floor preparation under Drawing settings.
- Proposals show the model-authored brand direction and requested deliverables linked to actual elements, separately from geometry warnings. Counts verify presence, not aesthetic quality. Never label a zone-only footprint or a concept image as a furnished interior. Apply remains explicit.
- Planned schematic partition faces use their saved design color so the proposed brand palette is visible in 3D; selection and edge markers retain semantic tokens. Asset models keep authored materials.
- Remove marketing subtitles, decorative workflow steps, duplicate status copy and implementation details. Preserve actionable errors, scale warnings, review coverage and explicit proposal approval.
- Send is conversational. Draft a layout creates a reviewable proposal; Apply changes commits it. Never imply chat itself performed an edit.

- While Muse designs, grouped installation edits and review corrections appear in the same 3D/2D viewport with “Live draft · not saved”. This ephemeral overlay never enters project persistence or undo history. Apply commits only the final reviewed proposal. Cancel, failures, changed drawing/references and unmount discard the preview; camera navigation stays available.

- Editing is conversational: no manual editing menu in the workspace header and no immediate Delete action in the selection card. Keep canvas selection, the selected-element context card, Clear selection and Ask about this. Send selected IDs and labels to intent routing, conversation and design requests; changes remain reviewed proposals. Do not show a standalone Confirm scale button in the conversation. Keep manual scale calibration in Drawing settings.

- Sample venue projects include an original fictional Meta-service planning brief and two selected brand bookmarks with authored notes. Briefs are stored as UTF-8 text assets and exported with the project. Clearly label fictional planning assumptions; URLs are bookmarks, not fetched pages or official brand guidelines. Existing projects are not overwritten.
- The sample picker lists venue projects, showing included drawing names and counts. Creating a sample copies all originals and extracts the listed PDF pages into separate drawings before opening; do not create partial projects on extraction failure or silently omit missing files. The header immediately switches among the included drawings. Existing user projects are not regrouped.

- The sidebar lists projects, not legacy sample drawings. Explicitly consolidated sample projects appear once; old links open the corresponding drawing in the retained project. Preserve the old rows and originals for recovery, and reject writes from stale tabs until they reload. Independently designed projects remain separate even when they share a venue.

- App Settings uses a centered dialog and a centered content column up to 640px wide. Each section has a heading; setting rows pair left-aligned labels/descriptions with right-aligned controls. Use separators between API key actions and stack rows on narrow screens. Keep the section navigation, scrollable content and keyboard dismissal.

## Physical dimensions

One scene unit is one metre. Object width/depth/height are local outer bounds before rotation; rotation swaps the footprint axes, never the stored dimensions. Model objects use catalog native metre bounds (5 mm input rounding is normalized); changed proportions are rejected by design tools. A mismatched legacy asset is shown as its declared-size box with a warning, never as a silently shrunken model. Schematic fixtures use the declared assumption sizes in `lib/assets/fixtures.ts`; mesh outer bounds, 2D footprints and collision boxes share those sizes. Partitions of arbitrary length use exact schematic geometry or multiple native-size modules. Never relabel a truss as a phone stand or a coffee table as a work desk.

Confirm the cropped drawing extent or a known measured distance before design. A scale confirmation establishes the coordinate conversion, not surveyed geometry. The KINTEX demo uses the printed 1B extent (90 × 63 m). The reviewed floor outline defines the entire event design area; a smaller legacy event footprint must not leave the remaining interior undesigned. Source-image margins and canvas outside that outline are not event floor. See `docs/dimensions.md` for assumptions and limits.

Whole-space interior and zoning proposals must account for the entire reviewed floor with purposeful zones, including connected circulation and operational space. Interior proposals need actual installations in functional zones; a coloured rectangle alone is not decoration. Keep circulation clear and preserve native object dimensions. Small targeted edits preserve unrelated design. If the floor outline is missing, request its review instead of claiming that paper margins are usable hall. Purpose-zone rectangles are clipped to the floor outline, including concave boundaries; physical installations must remain wholly inside it.

Whole-space interior completion also requires floor-level installations to span at least half of each functional zone's actual clipped width and depth. This is a product rule against tiny clusters inside oversized zones, not an occupancy, accessibility or aesthetic certification. Circulation and explicitly zoning-only proposals are exempt; the AI must still inspect the complete floor in its visual review.

In the workspace, the floor uses the indoor-floor material and a perimeter following the reviewed outline. Everything outside is a neutral canvas with a grid, visibly separate from event floor. This boundary is consistent in 2D, 3D and photography and never rescales the drawing or its objects.

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

In the drawing space, Muvi is a small companion: cap model scale at 0.4 (about 0.85 scene units tall, roughly half an adult reference). Never enlarge it for a larger venue. Tiny spaces may shrink it further. This is a visual proportion, not an occupancy or simulation body.

## Language

Only `en` (Eng) and `ko` (한국어) are supported. App Settings changes the UI immediately; Korean is the default. The browser stores the preference and synchronizes other tabs. When storage is unavailable, the preference works for the session.

`lib/i18n/en.json` and `ko.json` are the language packs. Both must have matching keys and interpolation parameters. Use `useI18n().t()` in components and `translate()` in pure helpers. Keep full sentences together when numbers or word order differ.

Language changes preserve the conversation, composer, loaded drawing, undo history and selected sources. New Muse requests include the language enum. Historical messages, imported source text, filenames, user labels and external engine diagnostics remain original evidence; never silently rewrite them.

## Verification

For UI review across this project, capture one representative desktop view in English (1920 × 1080) per task. Do not produce mobile captures or additional screenshots unless explicitly requested. This capture preference does not change the application’s default language or functional test coverage. Check both languages in the conversation, sources, settings, drawing controls, 2D and 3D views. Verify refresh persistence, keyboard dismissal, mobile overflow and draft preservation. Run the repository's web and engine checks before merging.

## Chat components

Muse uses adapted Vercel AI Elements Conversation, Message/MessageResponse and
PromptInput components under `components/ai-elements` (source and license there).
Conversation follows new messages until the reader scrolls away; a localized
button returns to the latest message. Scrolling is instant, including reduced motion.
Assistant Markdown uses Streamdown; user input remains literal text. Sources,
automatic intent routing, bilingual labels, cancellation and explicit proposal
approval remain owned by StudioChat. File attachments remain in the Sources dialog.

## Muvi motion gallery

`/muvi/gallery` is a standalone motion review page: one large orbitable preview, four selectable designer studies, pause, replay, hide and language controls. Work gestures contain no staged result geometry. Recognizable hand tools (hammer, tape measure, broad brush) and brief impact accents are encouraged; they must never imply a particular surface or completed result. Motion is deliberately cartoon-like: bold anticipation, brisk action, squash/stretch and rebound, rather than subtle physical realism. A direction control and floor marker preview their local work orientation, independent of the camera. Use broad whole-body anticipation and fast action, with trailing recovery. Feet can rock and tap within the local stage but must not penetrate the floor. The hammer and working arm rise overhead and behind the head, then swing down toward the wall while the torso gives a small backward recoil over the planted feet; it must not visibly separate from them. Hammer strikes face forward into an implied vertical wall; no wall mesh is baked in. Impact accents are bright unlit star flashes and outward-travelling diamond sparks anchored at the contact, never wooden debris or an effect dragged by the recoiling hammer. Reduced motion and hidden pages stop animation.

Designer tool operations stream as ephemeral Muvi cues: inspect, measure, arrange and paint. The agent selects a cue per grouped edit; other tools have deterministic cues. The existing reply status shows the current work gesture. Muvi pauses its illustrative patrol while working and resumes when the design ends, fails, is cancelled or the drawing/references change. Pause/hide, reduced motion and hidden-page behavior remain authoritative. Cues never claim successful construction or apply, save or export changes.

## AI photography

Chat photography requests produce a semantic shooting intent, actual 16:9 scene candidates, and an image-based model review with at most three rounds. Unsupported or unsuitable results remain errors, never approved substitutes. Photographing never changes drawing geometry. Muvi roaming, selection highlights and editor controls are excluded from photographs.

The selected photograph opens its exact camera pose and display settings in a letterboxed 16:9 viewer. Users can orbit/pan/zoom or expand fine adjustments, reopen the saved angle, retake and download the photograph. The original AI explanation describes its selected composition; a manually retaken photograph is labelled as user adjusted, not AI re-reviewed. Photos are session-only and this is stated beside download. Switching or editing drawings, changing references, cancellation and closing discard pending work. PDF export is not part of this flow.

On narrow screens, photography keeps the 16:9 live frame above an independently scrolling adjustment panel. Ordinary camera presets/settings are hidden during photography on these screens; closing photography restores them.

Photography frames installed subjects by default; only an explicit whole-venue intent includes the full hall. Candidate fitting uses the actual 16:9 perspective and varies azimuth, elevation and distance. The AI reviews empty-floor proportion, subject readability and foreground obstructions; fixable issues trigger a revised angle with the original user request and previous review reason carried forward. Provisional first-shot instructions must not replace the final composition goal. An expandable composition history retains actual candidate thumbnails and each review reason for the session, including when a later round fails. Camera framing never changes the saved venue dimensions or arrangement.

Ordinary space photographs default to a visitor standing inside: 1.65 m eye height, a level horizon, moderately wide perspective, full-height walls and the known ceiling. Prefer clear entrances and circulation viewpoints that reveal a meaningful activity, rather than fitting the whole hall into one image. Eye-level candidates require a reviewed floor boundary and a clear standing position. Image-based revisions preserve this visitor perspective and move horizontally or change distance; they never silently fly upward or cut away walls. Explicit overhead/layout/elevated-detail requests retain their elevated framing.

## Seating usability

Physical object rotations support 0/90/180/270 degrees; zones retain 0/90. Fixture seating faces local -Y (north at 0°) and stores its served table/stage via useTargetId. The plan view and generated review drawings mark seat fronts. Generated seating must pass the explicit reach, pullback, legroom and connected internal approach checks in `lib/plans/usability.ts`, in addition to collision checks, before visual review/submission. Existing layouts remain readable and show localized usability issues in Items to review. Checks are concept planning allowances, not accessibility, egress or crowd certification; details and omissions are documented in `docs/dimensions.md`.

## Deferred exhibitor workflow

The current product demo focuses on spatial designers. Hide the Organize / Participate mode switch and the Booth pricing · applications entry from the workspace. Keep the existing participant implementation and direct project links for future work; this is a navigation change, not a deletion of user data or an access-control change. The demo film must not include exhibitor workflows or present them as current product scope.
