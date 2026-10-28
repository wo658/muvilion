import { getAsset } from "@/server/projects/store";
import { projectRoute } from "@/server/projects/http";
export async function GET(req: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
  return projectRoute(req, async () => {
    const { id, assetId } = await context.params, file = getAsset(id, assetId);
    return new Response(file.data, { headers: { "Content-Type": /^[\w.+-]+\/[\w.+-]+$/.test(file.mimeType) ? file.mimeType : "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
  });
}
