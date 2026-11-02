import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const requestContext = vi.hoisted(() => ({ preference: undefined as string | undefined, host: "localhost:3000" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => requestContext.preference ? { value: requestContext.preference } : undefined }), headers: async () => new Headers({ host: requestContext.host }) }));
vi.mock("@/server/settings/store", () => ({ storedMetaKey: () => undefined }));
vi.mock("@ai-sdk/openai-compatible", () => ({ createOpenAICompatible: () => () => ({}) }));
import { selectMetaModel } from "@/lib/model-mode";
import { getModel } from "@/server/agent/model";
import { GET, POST } from "@/app/api/settings/model-mode/route";
const standard = "muse-spark-1.3", contributor = `${standard}-contributor`;
const request = (mode: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/settings/model-mode", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(mode) });
beforeEach(() => { requestContext.preference = undefined; requestContext.host = "localhost:3000"; vi.stubEnv("META_MODEL", contributor); vi.stubEnv("MODEL_PROVIDER", "meta"); });
afterEach(() => vi.unstubAllEnvs());

describe("browser-scoped model data preference", () => {
  it("keeps remote visitors Standard even with a Contributor environment, and honors opt-in/out", async () => {
    requestContext.host = "demo.example.com";
    expect((await getModel()).modelId).toBe(standard);
    requestContext.preference = "contributor";
    expect((await getModel()).modelId).toBe(contributor);
    requestContext.preference = "standard";
    expect((await getModel()).modelId).toBe(standard);
    requestContext.preference = undefined; // another visitor without consent
    expect((await getModel()).modelId).toBe(standard);
    expect(selectMetaModel(contributor, "invalid", "localhost:3000")).toBe(standard);
  });
  it("retains localhost developer defaults and leaves unsupported models/providers alone", async () => {
    expect((await getModel()).modelId).toBe(contributor);
    requestContext.preference = "standard";
    expect((await getModel()).modelId).toBe(standard);
    expect(selectMetaModel("muse-wonder-1.0", "contributor", "demo.example.com")).toBe("muse-wonder-1.0");
    expect(selectMetaModel("muse-spark-1.2", "contributor", null)).toBe("muse-spark-1.2-contributor");
    vi.stubEnv("MODEL_PROVIDER", "baseten");
    expect((await getModel()).provider).toBe("baseten");
    expect((await POST(request("contributor"))).status).toBe(409);
  });
  it("persists only in a protected browser cookie and does not mutate the environment", async () => {
    const response = await POST(request("standard"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: "standard", modelId: standard });
    expect(response.headers.get("set-cookie")).toMatch(/muvilion-model-mode=standard/);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
    expect(process.env.META_MODEL).toBe(contributor);
    expect((await GET(new Request("http://localhost:3000/api/settings/model-mode"))).headers.get("cache-control")).toBe("no-store");
  });
  it("rejects cross-origin changes and malformed consent without setting a cookie", async () => {
    for (const req of [request("contributor", "https://evil.example"), request({ enabled: true }), request("yes")]) {
      const response = await POST(req);
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });
});
