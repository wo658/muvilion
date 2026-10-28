import { expect, test } from "@playwright/test";
/** 새 프로젝트에서 통합 설정의 자료 메뉴 열기와 닫기를 검증한다. */
test("스튜디오 시작과 자료 설정 열기 및 닫기", async ({ page }) => {
  await test.step("새 프로젝트 열기", async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "새 프로젝트", exact:true }).click();
    await expect(page.getByRole("heading", { name: "어떤 공간을 만들고 싶으세요?" })).toBeVisible();
  });
  await test.step("설정에서 자료 메뉴 열기", async () => {
    await page.getByRole("button", { name: "설정", exact: true }).click();
    const dialog=page.getByRole("dialog", { name: "설정", exact:true });
    await dialog.getByRole("button", { name: "자료", exact:true }).click();
    await expect(dialog.getByRole("button", { name: "자료", exact:true })).toHaveAttribute("aria-current","page");
  });
  await test.step("설정 닫기", async () => {
    const dialog=page.getByRole("dialog", { name: "설정", exact:true });
    await dialog.getByRole("button", { name: "닫기", exact:true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "어떤 공간을 만들고 싶으세요?" })).toBeVisible();
  });
});
