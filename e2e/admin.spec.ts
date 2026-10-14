import { expect, test, type Page } from "@playwright/test";
import { loginAsOwner } from "./support/auth";
import { runId } from "./support/env";

/**
 * Real-browser admin flows against the isolated Backend (see e2e/README.md).
 * Every write uses run-unique names in the throwaway database.
 */

const names = {
  service: `خدمت آزمون ${runId}`,
  staffFirst: "کارمند",
  staffLast: `آزمون ${runId}`,
  resource: `اتاق آزمون ${runId}`,
};
const staffName = `${names.staffFirst} ${names.staffLast}`;

function trackServerErrors(page: Page) {
  const errors: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
  });
  return errors;
}

test.describe("admin", () => {
  test("owner logs in and sees the dashboard", async ({ page }) => {
    const serverErrors = trackServerErrors(page);
    await loginAsOwner(page);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("اطلاعات داشبورد دریافت نشد")).toHaveCount(0);
    expect(serverErrors).toEqual([]);
  });

  test("manage service: create, then find it in the list", async ({ page }) => {
    const serverErrors = trackServerErrors(page);
    await loginAsOwner(page);
    await page.goto("/admin/services/new");
    await page.getByRole("textbox", { name: "نام خدمت" }).fill(names.service);
    await page.getByRole("tab", { name: "مدت و ظرفیت" }).click();
    await page.getByRole("spinbutton", { name: "مدت خدمت (دقیقه)" }).fill("45");
    await page.getByRole("tab", { name: "قیمت و بیعانه" }).click();
    await page.getByRole("button", { name: "نوع قیمت" }).click();
    await page.getByRole("option", { name: /ثابت/ }).click();
    await page.getByRole("spinbutton", { name: /^قیمت/ }).fill("1500000");
    await page.getByRole("button", { name: "ایجاد خدمت" }).click();
    await expect(page).toHaveURL(/\/admin\/services\/(?!new$)[^/]+$/);
    await expect(page.getByText(names.service).first()).toBeVisible();

    await page.goto("/admin/services");
    await expect(page.getByText(names.service).first()).toBeVisible();
    expect(serverErrors).toEqual([]);
  });

  test("manage staff: create a staff member", async ({ page }) => {
    const serverErrors = trackServerErrors(page);
    await loginAsOwner(page);
    await page.goto("/admin/staff/new");
    await expect(page.getByRole("button", { name: "نوع کارمند" })).toBeEnabled();
    await page.getByRole("textbox", { name: /^نام(?! خانوادگی)/ }).fill(names.staffFirst);
    await page.getByRole("textbox", { name: /نام خانوادگی/ }).fill(names.staffLast);
    await page.getByRole("button", { name: "ایجاد کارمند" }).click();
    await expect(page).toHaveURL(/\/admin\/staff\/(?!new$)[^/]+$/);
    await expect(page.getByText(staffName).first()).toBeVisible();

    // The list renders a table and a card list and shows one per viewport.
    await page.goto("/admin/staff");
    await expect(page.getByText(staffName).filter({ visible: true }).first()).toBeVisible();
    expect(serverErrors).toEqual([]);
  });

  test("manage resource: create a room", async ({ page }) => {
    const serverErrors = trackServerErrors(page);
    await loginAsOwner(page);
    await page.goto("/admin/resources/new");
    await expect(page.getByRole("button", { name: "نوع منبع" })).toBeEnabled();
    await page.getByRole("textbox", { name: "نام" }).fill(names.resource);
    await page.getByRole("button", { name: "ایجاد منبع" }).click();
    await expect(page).toHaveURL(/\/admin\/resources\/(?!new$)[^/]+$/);
    await expect(page.getByText(names.resource).first()).toBeVisible();

    await page.goto("/admin/resources");
    await expect(page.getByText(names.resource).first()).toBeVisible();
    expect(serverErrors).toEqual([]);
  });

  test("calendar flow: navigate dates and switch views", async ({ page }) => {
    const serverErrors = trackServerErrors(page);
    await loginAsOwner(page);
    await page.goto("/admin/calendar");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const before = new URL(page.url()).searchParams.get("date");
    await page.getByRole("button", { name: /بعدی/ }).first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get("date")).not.toBe(before);

    await page.getByRole("button", { name: /هفته/ }).first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("week");
    expect(serverErrors).toEqual([]);
  });
});
