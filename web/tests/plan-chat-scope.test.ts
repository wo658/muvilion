import { expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ stream: vi.fn((options: unknown) => ({ options })) }));
vi.mock("ai", async importOriginal => ({ ...await importOriginal<typeof import("ai")>(), streamText: mock.stream }));
vi.mock("@/server/agent/model", () => ({ getModel: () => ({ hasKey: true, model: {} }) }));
import { RequestBody, chatPlan } from "@/server/plans/chat";

it("단일 제작 대화는 오래된 역할·가격 데이터를 모델에 전달하지 않는다", () => {
  const input = RequestBody.parse({
    messages: [{ role: "user", parts: [{ type: "text", text: "브랜드 공간을 기획해줘" }] }],
    role: "organizer", boothPricing: [{ name: "PRIVATE_PRICING", price: 987654321 }],
  });
  chatPlan(input, new AbortController().signal);
  const options = mock.stream.mock.calls[0][0] as { instructions: string; messages: unknown[] };
  expect(JSON.stringify(options.messages)).not.toContain("PRIVATE_PRICING");
  expect(JSON.stringify(options.messages)).not.toContain("987654321");
  expect(options.instructions).toContain("Participation, booth sales, applications and approval workflows are not available");
});
