import { expect, test } from "@playwright/test";
import { loginAsCustomer } from "./support/auth";
import { apiAuth, backend, nextOpenSlot, registerCustomer } from "./support/backend";
import { e2eEnv, runId } from "./support/env";

/**
 * Customer booking wizard against the isolated Backend. The Backend has no customer-readable
 * branch list, so the wizard is entered from a branch-specific link (service and branch in the
 * URL); the Backend validates both on availability and on POST /appointments/me.
 */

const password = "E2e-Booking-Pass-1";
const customerMobile = `0916${String(Date.now()).slice(-7)}`;

test("customer: booking wizard from a branch link creates the appointment", async ({ page }) => {
  const api = await backend();
  try {
    await registerCustomer(api, customerMobile, password, `رزرو ${runId}`);
    const customer = await apiAuth(api, customerMobile, password);
    const slot = await nextOpenSlot(api, customer);

    await loginAsCustomer(page, customerMobile, password);
    await page.goto(`/booking?service=${e2eEnv.serviceId}&branch=${e2eEnv.branchId}`);
    await expect(page.getByRole("radio", { name: "E2E Fixture Service" })).toBeChecked();
    await page.getByRole("button", { name: "ادامه" }).click();

    const day = page.locator(`[role="gridcell"][data-date="${slot.date}"]`);
    await expect(page.locator('[role="gridcell"][data-date]').first()).toBeVisible();
    if ((await day.count()) === 0) {
      await page.getByRole("button", { name: "ماه بعد" }).click();
    }
    await day.click();
    await page.getByRole("button", { name: "ادامه" }).click();
    await page.locator(`input[name="booking-slot"][value="slot_${Date.parse(slot.start)}"]`).check();
    await page.getByRole("button", { name: "ادامه" }).click();
    await expect(page.getByRole("heading", { name: "خلاصه", level: 2 })).toBeVisible();
    await page.getByRole("button", { name: "ادامه" }).click();

    const consent = page.getByRole("checkbox", { name: /قوانین لغو و تغییر نوبت/ });
    if (await consent.isVisible().catch(() => false)) {
      await consent.check();
    }
    const submit = page.getByRole("button", { name: "ثبت نهایی" });
    await expect(submit).toBeEnabled();
    await submit.click();
    await page.waitForURL(/\/booking\/confirmation\//);

    const reference = decodeURIComponent(new URL(page.url()).pathname.split("/").pop() ?? "");
    const response = await api.get("appointments/me/upcoming", { headers: customer });
    expect(response.status(), await response.text()).toBe(200);
    const body = (await response.json()) as {
      data: { items: { booking_reference: string; starts_at: string; branch: { id: string } }[] };
    };
    const booked = body.data.items.find((item) => item.booking_reference === reference);
    expect(booked, JSON.stringify(body.data.items)).toBeDefined();
    expect(Date.parse(booked!.starts_at)).toBe(Date.parse(slot.start));
    expect(booked!.branch.id).toBe(e2eEnv.branchId);
  } finally {
    await api.dispose();
  }
});
