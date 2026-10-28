import { UpdateBoothProjectSchema } from "@/lib/booths/schema";
import { readBoothProject, updateBoothProject } from "@/server/booths/service";
import { boothHttp, bearer, readBoothBody } from "@/server/booths/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return boothHttp(async () => readBoothProject((await context.params).id, bearer(request)));
}
export async function PATCH(request: Request, context: Context) {
  return boothHttp(async () => updateBoothProject((await context.params).id, bearer(request), await readBoothBody(request, UpdateBoothProjectSchema, 512_000)));
}
