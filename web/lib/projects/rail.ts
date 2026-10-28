import type { ProjectSummary } from "./schema";

/** Tile label: the first two English letters of the name ("KINTEX · 2홀" → "KI"); names without
 *  English letters fall back to their first character. */
export function monogram(name: string) {
  const latin = name.match(/[a-z]/gi);
  if (latin) return latin.slice(0, 2).join("").toUpperCase();
  return [...name.trim()][0] ?? "?";
}

/** Most recently updated projects for the collapsed rail, always including the open one. */
export function recentProjects(projects: ProjectSummary[], currentId: string | undefined, limit = 5) {
  const sorted = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const recent = sorted.slice(0, limit);
  const current = sorted.find(item => item.id === currentId);
  if (current && !recent.includes(current)) recent.splice(limit - 1, 1, current);
  return recent;
}

export function matchProjects(projects: ProjectSummary[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  return needle ? projects.filter(item => item.name.toLocaleLowerCase().includes(needle)) : projects;
}
