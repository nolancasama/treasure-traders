import { expect, test } from "@playwright/test";

test("the app boots without page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await expect(page.locator("#root")).not.toBeEmpty();
  expect(errors).toEqual([]);
});
