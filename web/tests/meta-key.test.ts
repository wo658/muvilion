import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const providerOptions = vi.hoisted(() => vi.fn());
vi.mock("@ai-sdk/openai-compatible", () => ({ createOpenAICompatible: (options: unknown) => { providerOptions(options); return () => ({}); } }));
import { changeKey, keyStatus } from "@/server/settings/meta-key";
import { storedMetaKey } from "@/server/settings/store";
import { getModel } from "@/server/agent/model";
import { GET, POST } from "@/app/api/settings/meta-key/route";
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "muvilion-key-"));
  vi.stubEnv("MUVILION_DATA_DIR", directory);
  vi.stubEnv("MODEL_API_KEY", "");
  vi.stubEnv("MODEL_PROVIDER", "meta");
  providerOptions.mockClear();
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });
const request = (body: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/settings/meta-key", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body),
});
describe("local Meta key settings", () => {
  it("persists across connections without returning the key and applies it to model calls", async () => {
    const response = await POST(request({ action: "save", key: "LLM|test|saved-only" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ stored: true, environmentAvailable: false, activeProvider: "meta", source: "sqlite" });
    expect(storedMetaKey()).toBe("LLM|test|saved-only");
    const status = await GET(new Request("http://localhost:3000/api/settings/meta-key"));
    expect(status.headers.get("cache-control")).toBe("no-store");
    expect(await status.text()).not.toContain("saved-only");
    const model = getModel({ MODEL_PROVIDER: "baseten", MODEL_API_KEY: "old-env-key" });
    expect(model.provider).toBe("meta");
    expect(model.hasKey).toBe(true);
    expect(providerOptions).toHaveBeenCalledWith(expect.objectContaining({ name: "meta", apiKey: "LLM|test|saved-only" }));
    if (process.platform !== "win32") expect(statSync(join(directory, "app.sqlite")).mode & 0o777).toBe(0o600);
  });
  it("imports environment keys and restores environment use after removal", async () => {
    vi.stubEnv("MODEL_API_KEY", "LLM|test|env-only");
    expect((await POST(request({ action: "import" }))).status).toBe(200);
    expect(storedMetaKey()).toBe("LLM|test|env-only");
    const response = await POST(request({ action: "remove" }));
    expect(await response.json()).toMatchObject({ stored: false, source: "environment" });
    getModel();
    expect(providerOptions).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "LLM|test|env-only" }));
  });
  it("preserves Baseten configuration when no Meta key was saved", () => {
    expect(getModel({ MODEL_PROVIDER: "baseten", BASETEN_API_KEY: "test-baseten" }).provider).toBe("baseten");
    expect(providerOptions).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "test-baseten" }));
  });
  it("rejects invalid keys and absent imports without replacing the existing key", async () => {
    changeKey({ action: "save", key: "test-existing" });
    for (const key of ["", "   ", "has spaces", "has\nnewline", "x".repeat(4097)]) {
      expect((await POST(request({ action: "save", key }))).status).toBe(400);
    }
    expect((await POST(request({ action: "import" }))).status).toBe(409);
    expect(storedMetaKey()).toBe("test-existing");
  });
  it("accepts loopback Host when Next normalizes the internal request URL", async () => {
    const response = await POST(new Request("http://localhost:3000/api/settings/meta-key", {
      method: "POST", headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", "content-type": "application/json" },
      body: JSON.stringify({ action: "save", key: "test-loopback" }),
    }));
    expect(response.status).toBe(200);
  });
  it("rejects external origins, non-local hosts and malformed requests", async () => {
    expect((await POST(request({ action: "save", key: "test-key" }, "https://elsewhere.test"))).status).toBe(403);
    expect((await GET(new Request("http://example.test/api/settings/meta-key"))).status).toBe(403);
    expect((await GET(new Request("http://localhost:3000/api/settings/meta-key", { headers: { host: "evil.test" } }))).status).toBe(403);
    expect((await POST(new Request("http://localhost:3000/api/settings/meta-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).status).toBe(400);
    expect(keyStatus()).toMatchObject({ stored: false, source: "none" });
  });
});
