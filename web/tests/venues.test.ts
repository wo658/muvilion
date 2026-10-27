import { createUIMessageStream, readUIMessageStream } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentUIMessage } from "@/lib/agent/events";
import { DEFAULT_VENUE_ID, runRequestBody, venueById, VENUES } from "@/lib/venues";

async function lastMessage(res: Response): Promise<AgentUIMessage | undefined> {
  const { parseJsonEventStream, uiMessageChunkSchema } = await import("ai");
  void createUIMessageStream;
  const chunks = parseJsonEventStream({ stream: res.body!, schema: uiMessageChunkSchema }).pipeThrough(
    new TransformStream({ transform: (c, ctl) => (c.success ? ctl.enqueue(c.value) : undefined) }),
  );
  let last: AgentUIMessage | undefined;
  for await (const m of readUIMessageStream<AgentUIMessage>({ stream: chunks as never })) last = m;
  return last;
}

const post = async (query: string, body: unknown = {}) => {
  const { POST } = await import("@/app/api/agent/route");
  return POST(new Request(`http://localhost/api/agent${query}`, { method: "POST", body: JSON.stringify(body) }));
};

describe("venue picker", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("offers one indoor and one outdoor sample", () => {
    expect(VENUES.map((v) => v.setting)).toEqual(["indoor", "outdoor"]);
    expect(VENUES.every((v) => v.project.venue.id === v.id)).toBe(true);
    expect(venueById(DEFAULT_VENUE_ID)?.setting).toBe("indoor");
  });

  it("selection becomes the POST body: live sends the project, replay names the venue", () => {
    const live = runRequestBody("live", "riverside-plaza");
    expect(live.venue).toBe("riverside-plaza");
    expect(live.project?.venue.setting).toBe("outdoor");
    expect(runRequestBody("replay", "riverside-plaza")).toEqual({ mode: "replay", venue: "riverside-plaza" });
    expect(() => runRequestBody("replay", "nowhere")).toThrow();
  });

  it.each(["sample-hall", "riverside-plaza"])("replay streams the %s recording", async (id) => {
    const res = await post("?speed=0", runRequestBody("replay", id));
    expect(res.status).toBe(200);
    const m = await lastMessage(res);
    const run = m?.parts.find((p) => p.type === "data-run");
    expect(run?.type === "data-run" && run.data.venue.id).toBe(id);
  });

  it("live runs use the selected project", async () => {
    vi.stubEnv("LIVE_AGENT", "on");
    vi.stubEnv("ENGINE_MOCK", "1");
    vi.stubEnv("AGENT_LLM", "stub");
    vi.stubEnv("AGENT_MAX_ITERATIONS", "0");
    const res = await post("", runRequestBody("live", "riverside-plaza"));
    const m = await lastMessage(res);
    const run = m?.parts.find((p) => p.type === "data-run");
    expect(run?.type === "data-run" && run.data.venue.setting).toBe("outdoor");
    // the venue's scenario override is locked in for the run
    expect(run?.type === "data-run" && run.data.scenario).toMatchObject(venueById("riverside-plaza")!.scenario!);
    expect(m?.parts.some((p) => p.type === "data-brief")).toBe(true);
  });

  it("rejects an unknown venue", async () => {
    expect((await post("?venue=nowhere&mode=replay")).status).toBe(400);
  });
});
