import { expect, test } from "@playwright/test";

/** 초기 화면과 Sources 대화상자의 실제 사용자 동작을 검증한다. */
test("스튜디오 시작과 Sources 열기 및 닫기", async ({ page }) => {
  await test.step("스튜디오 초기 화면 열기", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "어떤 공간을 만들고 싶으세요?" })).toBeVisible();
  });
  await test.step("Sources 대화상자 열기", async () => {
    await page.getByRole("button", { name: "자료", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "자료" })).toBeVisible();
  });
  await test.step("Sources 대화상자 닫기", async () => {
    await page.getByRole("button", { name: "자료 닫기", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "자료" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "어떤 공간을 만들고 싶으세요?" })).toBeVisible();
  });
});
