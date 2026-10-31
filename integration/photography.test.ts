import { expect, test } from "vitest";
import { createSteps } from "./steps";

const document = {
  schemaVersion: 1,
  source: { name: "촬영 검증.png", format: "image", page: 1, pages: 1, width: 100, height: 100 },
  preview: "data:image/png;base64,iVBORw0KGgo=",
  widthMeters: 12, heightMeters: 12, scaleConfirmed: false,
  lines: [], texts: [], warnings: [], method: "opencv",
  floorBoundary: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], objects: [],
};

/** 촬영 API는 모델 호출 전에 잘못된 입력을 거부한다. */
test("촬영 요청의 잘못된 형식과 미확정 축척을 거부한다", async context => {
  const step = createSteps(context);
  const invalid = await step("잘못된 촬영 요청 전송", () => fetch(`${process.env.WEB_URL}/api/plans/photography`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phase: "unknown" }),
  }));
  await step("형식 검증 오류 확인", async () => {
    // 모델 설정 상태와 무관하게 요청 형식 오류로 응답해야 한다.
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error).toEqual(expect.any(String));
  });
  const unscaled = await step("축척 미확정 도면 촬영 요청", () => fetch(`${process.env.WEB_URL}/api/plans/photography`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phase: "plan", document, brief: "전체 공간을 촬영해줘", locale: "ko" }),
  }));
  await step("모델 호출 전에 축척 확인 요구", async () => {
    // 임의 크기의 공간을 실제 촬영 결과로 제시하지 않아야 한다.
    expect(unscaled.status).toBe(422);
    expect((await unscaled.json()).error).toEqual(expect.any(String));
  });
});

/** 클라이언트가 도면에 없는 대상을 검토 요청에 넣어도 모델에 전달하지 않는다. */
test("존재하지 않는 촬영 대상의 이미지 검토를 거부한다", async context => {
  const step = createSteps(context);
  const response = await step("도면에 없는 대상의 촬영 검토 요청", () => fetch(`${process.env.WEB_URL}/api/plans/photography`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phase: "review", document: { ...document, scaleConfirmed: true }, locale: "ko", round: 0,
      intent: { title: "없는 대상", description: "존재하지 않는 공간", targetIds: ["missing-target"], view: "detail", azimuth: 45, elevation: 35, distanceScale: 1 },
      candidates: [{
        shot: { id: "candidate-a", eye: [7, 7, 7], target: [0, 1, 0], fov: 40, zoom: 1, aspect: 16 / 9, cutaway: true, ceilingMode: "hidden", showStructure: true, showOverhead: true },
        image: "data:image/png;base64,iVBORw0KGgo=",
      }],
    }),
  }));
  await step("검토 대상 검증 오류 확인", async () => {
    // 존재하지 않는 공간을 촬영했다는 결과가 생성되면 안 된다.
    expect(response.status).toBe(422);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
});

/** 자격 증명이 없는 격리 테스트 환경에서도 유효한 본문은 스키마 검증을 통과해야 한다. */
test("유효한 촬영 요청은 모델 설정 필요 오류까지 도달한다", async context => {
  const step = createSteps(context);
  const response = await step("완전한 도면을 포함한 촬영 계획 요청", () => fetch(`${process.env.WEB_URL}/api/plans/photography`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phase: "plan", document: { ...document, scaleConfirmed: true }, brief: "전체 공간을 촬영해줘", locale: "ko" }),
  }));
  await step("본문 오류가 아닌 모델 설정 오류 확인", async () => {
    // compose의 격리 웹 서비스에는 모델 자격 증명을 전달하지 않는다.
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/configured|API key|API 키/i);
  });
});

/** 이전 구도 피드백은 제한된 기록으로 전달하고 과도하거나 잘못된 기록은 모델 호출 전에 거부한다. */
test("촬영 재검토 기록의 형식과 횟수 한도를 검증한다", async context => {
  const step = createSteps(context);
  const intent = { title: "공간", description: "설치물 중심 구도", targetIds: [], view: "overview", framing: "subjects", azimuth: 45, elevation: 35, distanceScale: 1 };
  const body = {
    phase: "review", document: { ...document, scaleConfirmed: true }, locale: "ko", round: 1, intent,
    candidates: [{ shot: { id: "candidate-a", eye: [7, 7, 7], target: [0, 1, 0], fov: 40, zoom: 1, aspect: 16 / 9, cutaway: true, ceilingMode: "hidden", showStructure: true, showOverhead: true }, image: "data:image/png;base64,iVBORw0KGgo=" }],
  };
  const previous = { intent: { ...intent, distanceScale: 1.5 }, explanation: "빈 바닥을 줄이고 설치물을 크게 담습니다." };
  const valid = await step("이전 구도와 수정 이유를 포함한 재검토 요청", () => fetch(`${process.env.WEB_URL}/api/plans/photography`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, previousReviews: [previous] }),
  }));
  await step("유효한 기록은 모델 설정 확인까지 전달됨을 확인", () => {
    // 자격 증명 없는 격리 환경이므로 올바른 요청은 본문 오류 대신 모델 설정 오류를 반환한다.
    expect(valid.status).toBe(503);
  });
  const oversized = await step("한도를 넘는 이전 검토 세 건 전송", () => fetch(`${process.env.WEB_URL}/api/plans/photography`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, previousReviews: [previous, previous, previous] }),
  }));
  await step("과도한 검토 기록을 모델 호출 전에 거부함을 확인", () => {
    // 검토 횟수 한도를 우회해 불필요한 모델 문맥을 추가하지 않아야 한다.
    expect(oversized.status).toBe(400);
  });
});
