import { exportProject } from "@/server/projects/store";
import { projectRoute } from "@/server/projects/http";
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  return projectRoute(req, async () => exportProject((await context.params).id));
}
