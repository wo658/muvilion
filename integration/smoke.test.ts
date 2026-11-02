import { expect, test } from "vitest";
import { createSteps } from "./steps";

import { pdfFile } from "../web/tests/document-fixtures";

/** Python이나 모델 키 없이 실제 Next.js 문서 준비를 확인한다. */
test("Next.js에서 PDF 참고 페이지 준비", async (context) => {
  const step = createSteps(context);
  const response = await step("두 페이지 PDF 업로드", () => {
    const form = new FormData();
    form.set("file", pdfFile(2));
    return fetch(`${process.env.WEB_URL}/api/sources/pdf`, { method: "POST", body: form });
  });
  await step("원본 미리보기와 로컬 OCR 미실행 확인", async () => {
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.previews).toHaveLength(2);
    expect(result.previews.every((preview: string) => preview.startsWith("data:image/png;base64,"))).toBe(true);
    expect(result.text).toBe("");
  });
});

/** 실제 Node 문서 준비의 입력 오류가 HTTP 응답으로 보존된다. */
test("손상된 도면 업로드 거부", async (context) => {
  const step = createSteps(context);
  const response = await step("손상된 PDF를 웹 API로 업로드", () => {
    const form = new FormData();
    form.set("file", new Blob(["invalid pdf"], { type: "application/pdf" }), "broken.pdf");
    return fetch(`${process.env.WEB_URL}/api/plans/extract`, { method: "POST", body: form });
  });
  await step("문서 파일 검증 오류 확인", async () => {
    // 제거된 엔진에 연결하려다 실패하는 503이 아니라 입력 오류여야 한다.
    expect(response.status).toBe(422);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
});
