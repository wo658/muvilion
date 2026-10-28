import { createProject, listProjects } from "@/server/projects/store";
import { projectRoute, readJson } from "@/server/projects/http";
export async function GET(req: Request) { return projectRoute(req, () => listProjects()); }
export async function POST(req: Request) { return projectRoute(req, async () => createProject(await readJson(req, 400))); }
