# Project drawing sources

Open **Sources → ＋ Drawing** to add another PDF, PNG, JPG or DXF to the current project. Use **Open drawing** on a source to switch the workspace. A project holds up to 12 drawing sources plus 12 shared reference materials; each uploaded file may be up to 20 MB.

Each drawing keeps its geometry, scale, floor boundary, entrances and design objects in the project saved to SQLite. Opening another page in **Drawing settings** creates a source for that PDF page; reopening a previously opened page restores its edits instead of extracting it again. The last active drawing is restored after autosave and reload.

Undo history and unfinished dimension inputs are kept separately while switching within the current editor session. They are not part of the saved document or backup. Drawing tools and selection reset on a switch. Muse starts a fresh conversation for the active drawing, and any pending proposal from the previous drawing is discarded. Muse receives only the active drawing and the selected shared reference materials.

Existing single-drawing projects and backups remain readable and become the first drawing source when edited or extended. Project exports include every drawing's edits and all referenced original files; importing an export copies the files into the new project. Saving and importing a project are bounded to 400 MB per request.

## Source manager interaction references

Reviewed on 2026-10-31. These are interaction references, not copied UI assets or code.

- [NotebookLM sources](https://support.google.com/gemininotebook/answer/16215270?hl=en): separate adding material, selecting model context and opening source content. Here, drawings and shared references have separate groups; only the active drawing can join Muse context.
- [Notion files and media](https://www.notion.com/help/images-files-and-media): distinguish local uploads and external links. Here, concept images, briefs and brand bookmarks retain explicit input paths; bookmarks explain that page contents are not imported.
- [Figma file browser](https://help.figma.com/hc/en-us/articles/14381406380183-Guide-to-the-file-browser): recognizable file types and searchable browsing. Here, compact preview rows prioritize filenames, with type and page metadata secondary.

The source manager searches drawing names and reference names/URLs without changing selection. Removing a reference requires confirmation in its row; cancelling preserves the source. Drawing switching and source persistence keep their existing project semantics.
