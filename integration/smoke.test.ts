import { expect, test } from "vitest";
import { createSteps } from "./steps";

/** 실제 엔진의 현재 계산 의존성이 준비됐는지 확인한다. */
test("엔진 상태와 계산 라이브러리", async (context) => {
  const step = createSteps(context);
  const health = await step("엔진 상태 조회", async () => {
    const response = await fetch(`${process.env.ENGINE_URL}/health`);
    expect(response.status).toBe(200);
    return response.json();
  });
  await step("계산 라이브러리 준비 상태 확인", () => {
    // 실제 계산 라이브러리가 설치된 엔진이어야 한다.
    expect(health.status).toBe("ok");
    expect(Object.keys(health.versions).sort()).toEqual(["ortools", "shapely"]);
  });

});

/** 웹이 실제 엔진에 파일을 전달하고 엔진 오류를 HTTP 응답으로 보존한다. */
test("웹에서 엔진으로 도면 추출 요청 전달", async (context) => {
  const step = createSteps(context);
  const response = await step("손상된 PDF를 웹 API로 업로드", () => {
    const form = new FormData();
    form.set("file", new Blob(["invalid pdf"], { type: "application/pdf" }), "broken.pdf");
    return fetch(`${process.env.WEB_URL}/api/plans/extract`, { method: "POST", body: form });
  });
  await step("엔진의 파일 검증 오류 확인", async () => {
    // 연결 실패(503)가 아닌 엔진의 잘못된 파일 응답을 받아야 한다.
    expect(response.status).toBe(422);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
});
