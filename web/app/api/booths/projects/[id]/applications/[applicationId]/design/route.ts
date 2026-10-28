import { SaveBoothDesignSchema } from "@/lib/booths/schema";
import { saveBoothDesign } from "@/server/booths/service";
import { boothHttp, bearer, readBoothBody } from "@/server/booths/http";
export async function PATCH(request: Request, context: { params: Promise<{ id: string; applicationId: string }> }) {
  return boothHttp(async () => { const { id, applicationId } = await context.params; return saveBoothDesign(id, applicationId, bearer(request), await readBoothBody(request, SaveBoothDesignSchema, 256_000)); });
}
