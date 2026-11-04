import { z } from "zod";
import { createSampleProject, listSamples } from "@/server/projects/samples";
import { projectRoute, readJson } from "@/server/projects/http";
export const maxDuration = 1200;

export async function GET(req: Request) { return projectRoute(req, () => listSamples()); }
export async function POST(req: Request) { return projectRoute(req, async () => { const { id, live } = z.object({ id: z.string(), live: z.boolean().default(false) }).parse(await readJson(req, 1)); return createSampleProject(id, undefined, req.signal, live); }); }
