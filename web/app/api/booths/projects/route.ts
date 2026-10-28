import { CreateBoothProjectSchema } from "@/lib/booths/schema";
import { createBoothProject } from "@/server/booths/service";
import { boothHttp, readBoothBody } from "@/server/booths/http";
export async function POST(request: Request) {
  return boothHttp(async () => createBoothProject(await readBoothBody(request, CreateBoothProjectSchema)), 201);
}
