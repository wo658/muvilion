import { z } from "zod";
import { designBooth, BoothDesignerError } from "@/server/booths/designer";
import { getApplicationAccess } from "@/server/booths/service";
import { bearer, boothHttp, BoothError, readBoothBody } from "@/server/booths/http";

export const maxDuration = 120;
const GenerateRequest = z.object({ brief: z.string().trim().min(1).max(6000) });
export async function POST(request: Request, context: { params: Promise<{ id: string; applicationId: string }> }) {
  return boothHttp(async () => {
    const { id, applicationId } = await context.params;
    const token = bearer(request);
    const access = getApplicationAccess(id, applicationId, token);
    if (access.application.status !== "approved") throw new BoothError(403, "승인된 참가 부스만 디자인할 수 있습니다.");
    const { brief } = await readBoothBody(request, GenerateRequest, 32 * 1024);
    try {
      const result = await designBooth({
        booth: access.booth, company: access.application.company,
        brief, currentDocument: access.document, abortSignal: request.signal,
      });
      const latest = getApplicationAccess(id, applicationId, token);
      if (latest.application.status !== "approved") throw new BoothError(409, "부스 승인이 변경되었습니다. 상태를 새로 확인해 주세요.");
      return result;
    } catch (error) {
      if (error instanceof BoothError) throw error;
      if (error instanceof BoothDesignerError) throw new BoothError(error.status, error.message);
      throw new BoothError(502, "Muse 디자인 요청이 완료되지 않았습니다. 모델 연결을 확인하거나 다시 시도해 주세요.");
    }
  });
}
