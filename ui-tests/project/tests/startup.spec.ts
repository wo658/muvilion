import { expect, test } from "@playwright/test";
/** 새 프로젝트에서 자료 대화상자 열기와 닫기를 검증한다. */
test("스튜디오 시작과 자료 열기 및 닫기", async ({ page }) => {
  await test.step("새 프로젝트 열기", async () => {
    await page.goto("/");
    const blank=page.getByRole("button", { name: "빈 프로젝트로 시작", exact:true });
    await expect(blank.or(page.getByRole("button",{name:"설정",exact:true}))).toBeVisible();
    if(!await blank.isVisible()) await page.getByRole("button", { name: "새 프로젝트", exact:true }).click();
    const before=page.url();await blank.click();await expect(page).not.toHaveURL(before);
    await expect(page.getByRole("heading", { name: "어떤 공간을 만들고 싶으세요?" })).toBeVisible();
  });
  await test.step("대화에서 자료 열기", async () => {
    await page.getByRole("button", { name: "자료 추가", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "자료", exact:true })).toBeVisible();
  });
  await test.step("자료 닫기", async () => {
    const dialog=page.getByRole("dialog", { name: "자료", exact:true });
    await dialog.getByRole("button", { name: "닫기", exact:true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "어떤 공간을 만들고 싶으세요?" })).toBeVisible();
  });
});
