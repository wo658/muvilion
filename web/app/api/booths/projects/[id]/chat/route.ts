import { createUIMessageStreamResponse, toUIMessageStream } from "ai";
import { BoothChatRequest, chatBooth } from "@/server/booths/chat";
import { bearer, boothHttp, readBoothBody } from "@/server/booths/http";
export const maxDuration = 90;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let response: Response | undefined;
  const failure = await boothHttp(async () => {
    const input = await readBoothBody(request, BoothChatRequest, 200_000);
    const result = chatBooth((await context.params).id, input, bearer(request), request.signal);
    response = createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream, onError: () => "Muse가 답변하지 못했습니다. 다시 시도해 주세요." }) });
    return null;
  });
  return response ?? failure;
}
