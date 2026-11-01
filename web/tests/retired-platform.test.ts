import { describe, expect, it } from "vitest";
import { POST as create } from "@/app/api/booths/projects/route";
import { GET as read, PATCH as update } from "@/app/api/booths/projects/[id]/route";
import { POST as apply } from "@/app/api/booths/projects/[id]/applications/route";
import { GET as application, PATCH as review } from "@/app/api/booths/projects/[id]/applications/[applicationId]/route";
import { PATCH as save } from "@/app/api/booths/projects/[id]/applications/[applicationId]/design/route";
import { POST as design } from "@/app/api/booths/projects/[id]/applications/[applicationId]/design/generate/route";
import { POST as chat } from "@/app/api/booths/projects/[id]/chat/route";

const request = () => new Request("http://localhost/api/booths/projects", { method: "POST", body: "{}" });
const context = () => ({ params: Promise.resolve({ id: "old-project", applicationId: "old-application" }) });
const routes = [
  ["create", () => create(request())], ["read", () => read(request(), context())],
  ["update", () => update(request(), context())], ["apply", () => apply(request(), context())],
  ["application", () => application(request(), context())], ["review", () => review(request(), context())],
  ["save", () => save(request(), context())], ["design", () => design(request(), context())],
  ["chat", () => chat(request(), context())],
] as const;

describe("이전 부스 플랫폼 API 종료", () => {
  it.each(routes)("%s 요청은 작업이나 모델 실행 없이 종료를 알린다", async (_name, invoke) => {
    const response = await invoke();
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ code: "PLATFORM_DEFERRED" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
