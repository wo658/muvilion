import type { ProjectSummary } from "./schema";

/** Two-letter tile label: first letters of the first and last words ("KINTEX · 2홀" → "K2"). */
export function monogram(name: string) {
  const words = name.split(/[\s·\-_/()|,.]+/u).filter(Boolean);
  if (!words.length) return "?";
  const letters = words.length === 1 ? [...words[0]].slice(0, 2) : [[...words[0]][0], [...words.at(-1)!][0]];
  return letters.join("").toUpperCase();
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
