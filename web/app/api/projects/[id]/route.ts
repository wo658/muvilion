import { getProject, saveProject } from "@/server/projects/store";
import { projectRoute, readJson } from "@/server/projects/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, context: Context) { return projectRoute(req, async () => getProject((await context.params).id)); }
export async function PUT(req: Request, context: Context) { return projectRoute(req, async () => saveProject((await context.params).id, await readJson(req))); }
