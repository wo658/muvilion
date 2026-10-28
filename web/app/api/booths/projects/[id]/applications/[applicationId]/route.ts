import { ReviewApplicationSchema } from "@/lib/booths/schema";
import { getApplicationAccess, reviewBoothApplication } from "@/server/booths/service";
import { boothHttp, bearer, readBoothBody } from "@/server/booths/http";
type Context = { params: Promise<{ id: string; applicationId: string }> };
export async function GET(request: Request, context: Context) {
  return boothHttp(async () => { const { id, applicationId } = await context.params; return getApplicationAccess(id, applicationId, bearer(request)); });
}
export async function PATCH(request: Request, context: Context) {
  return boothHttp(async () => { const { id, applicationId } = await context.params; const body = await readBoothBody(request, ReviewApplicationSchema, 1000); return reviewBoothApplication(id, applicationId, bearer(request), body.status); });
}
