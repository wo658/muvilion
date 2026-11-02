import { z } from "zod";
import { createSampleProject, listSamples } from "@/server/projects/samples";
import { projectRoute, readJson } from "@/server/projects/http";
export const maxDuration = 1200;

export async function GET(req: Request) { return projectRoute(req, () => listSamples()); }
export async function POST(req: Request) { return projectRoute(req, async () => createSampleProject(z.object({ id: z.string() }).parse(await readJson(req, 1)).id, undefined, req.signal)); }
