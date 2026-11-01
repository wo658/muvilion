import { expect, test } from "vitest";
import { createSteps } from "./steps";

/** 이전 링크와 API가 참가 신청·승인·디자인 작업을 다시 열지 않도록 한다. */
test("주최측·참가측 API는 데이터 접근 없이 보류 상태를 반환한다", async context => {
  const step = createSteps(context);
  const endpoints = [
    ["POST", "/api/booths/projects"],
    ["GET", "/api/booths/projects/legacy"],
    ["PATCH", "/api/booths/projects/legacy"],
    ["POST", "/api/booths/projects/legacy/applications"],
    ["GET", "/api/booths/projects/legacy/applications/legacy"],
    ["PATCH", "/api/booths/projects/legacy/applications/legacy"],
    ["PATCH", "/api/booths/projects/legacy/applications/legacy/design"],
    ["POST", "/api/booths/projects/legacy/applications/legacy/design/generate"],
    ["POST", "/api/booths/projects/legacy/chat"],
  ];
  for (const [method, path] of endpoints) {
    const response = await step(`이전 ${method} ${path} 요청`, () => fetch(`${process.env.WEB_URL}${path}`, {
      method, ...(method === "GET" ? {} : { body: "{}", headers: { "content-type": "application/json" } }),
    }));
    await step(`${method} ${path}의 명시적 종료 확인`, async () => {
      // 잘못된 ID나 권한 오류가 아니라 기능 자체가 종료돼야 한다.
      expect(response.status).toBe(410);
      expect(await response.json()).toMatchObject({ code: "PLATFORM_DEFERRED" });
      expect(response.headers.get("cache-control")).toBe("no-store");
    });
  }
});

/** 예전에 배포된 참가측 링크도 단일 제작 스튜디오로 돌아간다. */
test("이전 참가측 링크는 제작 스튜디오로 이동한다", async context => {
  const step = createSteps(context);
  const response = await step("이전 참가 링크 열기", () => fetch(`${process.env.WEB_URL}/participate/legacy`, { redirect: "manual" }));
  await step("스튜디오 이동 응답 확인", () => {
    // 참가측 화면과 개인 정보 입력 폼을 다시 노출하지 않는다.
    expect([307, 308]).toContain(response.status);
    expect(new URL(response.headers.get("location")!, process.env.WEB_URL).pathname).toBe("/");
  });
});
