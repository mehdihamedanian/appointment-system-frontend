import { expect, type Page } from "@playwright/test";
import { e2eEnv } from "./env";

export async function loginAsOwner(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel(/شماره موبایل/).fill(e2eEnv.ownerMobile);
  await page.locator("#password").fill(e2eEnv.ownerPassword);
  await page.getByRole("button", { name: "ورود به پنل مدیریت" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/admin/login"));
  await expect(page).toHaveURL(/\/admin(\/|$|\?)/);
}

export async function loginAsCustomer(page: Page, mobile: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/شماره موبایل/).fill(mobile);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
