import { z } from "zod";
import { designBooth, BoothDesignerError } from "@/server/booths/designer";
import { getApplicationAccess } from "@/server/booths/service";
import { bearer, boothHttp, BoothError, readBoothBody } from "@/server/booths/http";

export const maxDuration = 120;
const GenerateRequest = z.object({ brief: z.string().trim().min(1).max(6000), locale: z.enum(["en", "ko"]).optional() });
export async function POST(request: Request, context: { params: Promise<{ id: string; applicationId: string }> }) {
  return boothHttp(async () => {
    const { id, applicationId } = await context.params;
    const token = bearer(request);
    const access = getApplicationAccess(id, applicationId, token);
    if (access.application.status !== "approved") throw new BoothError(403, "Only approved participant booths can be designed.");
    const { brief, locale } = await readBoothBody(request, GenerateRequest, 32 * 1024);
    try {
      const result = await designBooth({
        booth: access.booth, company: access.application.company,
        brief, locale, currentDocument: access.document, abortSignal: request.signal,
      });
      const latest = getApplicationAccess(id, applicationId, token);
      if (latest.application.status !== "approved") throw new BoothError(409, "The booth approval has changed. Refresh to check its status.");
      return result;
    } catch (error) {
      if (error instanceof BoothError) throw error;
      if (error instanceof BoothDesignerError) throw new BoothError(error.status, error.message);
      throw new BoothError(502, "The Muse design request did not complete. Check the model connection or try again.");
    }
  });
}
