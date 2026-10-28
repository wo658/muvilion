import { z } from "zod";
import { Project, ProjectExport, ProjectSummary, SampleDrawing, type ProjectState } from "./schema";
export async function callProject(url: string, options?: RequestInit) {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Could not save the project.");
  return body;
}
export const listProjects = async () => z.array(ProjectSummary).parse(await callProject("/api/projects"));
export const loadProject = async (id: string) => Project.parse(await callProject(`/api/projects/${encodeURIComponent(id)}`));
export const createProject = async (name: string, state?: ProjectState, assets: unknown[] = []) => Project.parse(await callProject("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, state, assets }) }));
export const saveProject = async (id: string, name: string, revision: number, state: ProjectState) => ProjectSummary.parse(await callProject(`/api/projects/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, revision, state }) }));
export async function uploadOriginal(id: string, file: File): Promise<string> {
  const body = new FormData(); body.set("file", file);
  return z.object({ id: z.string().uuid() }).parse(await callProject(`/api/projects/${id}/assets`, { method: "POST", body })).id;
}
export const exportProject = async (id: string) => ProjectExport.parse(await callProject(`/api/projects/${id}/export`));
export const listSamples = async () => z.array(SampleDrawing).parse(await callProject("/api/projects/samples"));
export const createSampleProject = async (file: string) => Project.parse(await callProject("/api/projects/samples", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file }) }));
