import { ApplyForBoothSchema } from "@/lib/booths/schema";
import { applyForBooth } from "@/server/booths/service";
import { boothHttp, readBoothBody } from "@/server/booths/http";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return boothHttp(async () => applyForBooth((await context.params).id, await readBoothBody(request, ApplyForBoothSchema, 32_000)), 201);
}
