import type { Project, ProjectState, ProjectSummary } from "./schema";
import { saveProject } from "./client";

/** Serialize saves and stop after failures; never silently overwrite another tab's revision. */
export class ProjectSession {
  state: ProjectState;
  name: string;
  revision: number;
  dirty = false;
  failure: Error | null = null;
  private saving: Promise<void> | null = null;
  constructor(readonly project: Project, private write: typeof saveProject = saveProject, private onSaved?: (summary: ProjectSummary) => void) {
    this.state = project.state; this.name = project.name; this.revision = project.revision;
  }
  update(state: ProjectState, name = this.name) { this.state = state; this.name = name; this.dirty = true; }
  get pending() { return this.dirty || Boolean(this.saving); }
  async flush(): Promise<void> {
    if (this.saving) { await this.saving; return this.flush(); }
    if (this.failure) throw this.failure;
    if (!this.dirty) return;
    const state = this.state, name = this.name;
    this.dirty = false;
    this.saving = this.write(this.project.id, name, this.revision, state).then(result => {
      this.revision = result.revision; this.onSaved?.(result);
    }).catch(error => {
      this.dirty = true; this.failure = error instanceof Error ? error : new Error("Could not save project."); throw this.failure;
    }).finally(() => { this.saving = null; });
    await this.saving;
    if (this.dirty) await this.flush();
  }
  retry() { this.failure = null; return this.flush(); }
}
