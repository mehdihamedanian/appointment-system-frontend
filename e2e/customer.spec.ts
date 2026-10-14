import { expect, test } from "@playwright/test";
import { loginAsCustomer } from "./support/auth";

/**
 * Real-browser customer flows against the isolated Backend (see e2e/README.md).
 * Each run registers a fresh customer in the throwaway database.
 */

const mobile = `0912${String(Date.now()).slice(-7)}`;
const password = "E2e-Customer-Pass-1";

test.describe.configure({ mode: "serial" });

test.describe("customer", () => {
  test("register signs the new customer in", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("textbox", { name: "نام", exact: true }).fill("مشتری");
    await page.getByRole("textbox", { name: "نام خانوادگی" }).fill("آزمون");
    await page.getByRole("textbox", { name: "شماره موبایل" }).fill(mobile);
    await page.getByRole("textbox", { name: "رمز عبور", exact: true }).fill(password);
    await page.getByRole("textbox", { name: "تکرار رمز عبور" }).fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "ایجاد حساب مشتری" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    const session = await page.request.get("/api/backend/auth/session");
    expect(session.status()).toBe(200);
  });

  test("my appointments loads for the signed-in customer", async ({ page }) => {
    await loginAsCustomer(page, mobile, password);
    await page.goto("/appointments");
    await expect(page).toHaveURL(/\/appointments/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /تلاش دوباره/ })).toHaveCount(0);
  });

  test("wrong password is rejected without signing in", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "شماره موبایل" }).fill(mobile);
    await page.locator("#password").fill(`${password}-wrong`);
    await page.getByRole("button", { name: "ورود", exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    const session = await page.request.get("/api/backend/auth/session");
    expect(session.status()).toBe(401);
  });
});
