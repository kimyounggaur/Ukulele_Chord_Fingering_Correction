import { test, expect } from "@playwright/test";

test("app shell renders without startup console errors", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto("http://localhost:5173");
  await expect(page.getByRole("heading", { name: "우쿨렐레 코드 운지 교정기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "카메라 시작" })).toBeVisible();
  await expect(page.getByRole("button", { name: "지판 보정" })).toBeVisible();
  await expect(page.getByText("지판 보정을 완료하세요")).toBeVisible();
  await expect(page.getByText("준비도 --")).toBeVisible();
  await expect(page.getByText("카메라를 시작하면 배치 상태를 확인합니다.")).toBeVisible();
  await expect(page.getByText("자세 검사")).toBeVisible();
  await expect(page.locator("#overlayCanvas")).toBeVisible();
  await expect(page.locator("#chordDiagram")).toBeVisible();

  await page.locator("#debugToggle").check({ force: true });
  await expect(page.locator("#debugOutput")).toContainText("quality");
  await expect(page.locator("#debugOutput")).toContainText("grammar");
  await expect(page.locator("#debugOutput")).toContainText("grading");

  expect(consoleErrors).toEqual([]);
});
