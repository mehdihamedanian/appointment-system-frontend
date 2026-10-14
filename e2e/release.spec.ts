import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { loginAsOwner } from "./support/auth";
import {
  apiAuth as login,
  availableSlots,
  backend,
  book,
  nextOpenSlot as openSlot,
  registerCustomer,
  type AuthHeaders,
  type Slot,
} from "./support/backend";
import { runId } from "./support/env";

/**
 * Release verification against a local production build and the isolated Backend
 * (see e2e/README.md). Appointments are created for run-unique customers in the
 * throwaway database; the payment gateway is intercepted so no transaction is made.
 */

const password = "E2e-Release-Pass-1";
const stamp = String(Date.now()).slice(-7);
const customerMobile = `0913${stamp}`;
const rivalMobile = `0914${stamp}`;
const GATEWAY = "https://fake-gateway.test";

const slotRadioValue = (start: string) => `slot_${Date.parse(start)}`;
const apiAuth = (api: APIRequestContext, mobile: string) => login(api, mobile, password);

function visibleText(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true }).first();
}

async function sessionStatus(page: Page) {
  return (await page.request.get("/api/backend/auth/session")).status();
}

async function pickRescheduleSlot(page: Page, slot: Slot) {
  const day = page.locator(`[role="gridcell"][data-date="${slot.date}"]`);
  await expect(page.locator('[role="gridcell"][data-date]').first()).toBeVisible();
  if ((await day.count()) === 0) {
    await page.getByRole("button", { name: "ماه بعد" }).click();
  }
  await day.click();
  const radio = page.locator(`input[name="booking-slot"][value="${slotRadioValue(slot.start)}"]`);
  await radio.check();
  await expect(radio).toBeChecked();
}

async function acknowledgeIfRequired(page: Page) {
  const ack = page.getByRole("checkbox", { name: /شرایط زمان‌بندی مجدد/ });
  if (await ack.isVisible().catch(() => false)) {
    await ack.check();
  }
}

test.describe.configure({ mode: "serial" });

test.describe("release: authentication", () => {
  test("customer session survives reload and a new tab; logout ends it", async ({ page, context }) => {
    await page.goto("/register");
    await page.getByRole("textbox", { name: "نام", exact: true }).fill("مشتری");
    await page.getByRole("textbox", { name: "نام خانوادگی" }).fill(`انتشار ${runId}`);
    await page.getByRole("textbox", { name: "شماره موبایل" }).fill(customerMobile);
    await page.getByRole("textbox", { name: "رمز عبور", exact: true }).fill(password);
    await page.getByRole("textbox", { name: "تکرار رمز عبور" }).fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "ایجاد حساب مشتری" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/appointments");
    await page.reload();
    await expect(page).toHaveURL(/\/appointments$/);
    expect(await sessionStatus(page)).toBe(200);

    const tab = await context.newPage();
    await tab.goto("/appointments");
    await expect(tab).toHaveURL(/\/appointments$/);
    await tab.close();

    await page.getByRole("button", { name: "خروج از حساب" }).click();
    await expect(page).toHaveURL(/\/login/);
    expect(await sessionStatus(page)).toBe(401);
    await page.goto("/appointments");
    await expect(page).toHaveURL(/\/login/);
  });

  test("owner session survives reload; logout from the user menu ends it", async ({ page }) => {
    await loginAsOwner(page);
    await page.reload();
    await expect(page).toHaveURL(/\/admin$/);
    expect(await sessionStatus(page)).toBe(200);

    await page.getByRole("button", { name: /^منوی کاربر/ }).click();
    await page.getByRole("menuitem", { name: "خروج" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    expect(await sessionStatus(page)).toBe(401);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe("release: customer appointments", () => {
  let context: BrowserContext;
  let page: Page;
  let api: APIRequestContext;
  let auth: AuthHeaders;
  const refs: Record<"pay" | "cancel" | "reschedule" | "conflict", string> = {
    pay: "",
    cancel: "",
    reschedule: "",
    conflict: "",
  };
  let bookedDay = "";
  let branchName = "";

  const nextOpenSlot = (predicate: (slot: Slot) => boolean) => openSlot(api, auth, predicate);

  test.beforeAll(async ({ browser }) => {
    api = await backend();
    auth = await apiAuth(api, customerMobile);
    // Four bookings share one day and overlapping slots close around each, so earlier runs can
    // leave the first open day too full.
    const perDay = new Map<string, number>();
    for (const slot of await availableSlots(api, auth)) {
      perDay.set(slot.date, (perDay.get(slot.date) ?? 0) + 1);
    }
    bookedDay = [...perDay].find(([, count]) => count >= 16)?.[0] ?? "";
    expect(bookedDay, "a fixture day with room for four appointments").not.toBe("");
    const first = await nextOpenSlot((slot) => slot.date === bookedDay);
    const pay = await book(api, auth, first);
    refs.pay = pay.reference;
    branchName = pay.branchName;
    for (const key of ["cancel", "reschedule", "conflict"] as const) {
      refs[key] = (await book(api, auth, await nextOpenSlot((slot) => slot.date === bookedDay))).reference;
    }

    context = await browser.newContext();
    page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel(/شماره موبایل/).fill(customerMobile);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "ورود", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  });

  test.afterAll(async () => {
    await context?.close();
    await api?.dispose();
  });

  test("booked appointments appear in the list and detail with the payment summary", async () => {
    await page.goto("/appointments");
    for (const reference of Object.values(refs)) {
      await expect(visibleText(page, reference)).toBeVisible();
    }
    await page.goto(`/appointments/${refs.pay}`);
    await expect(visibleText(page, refs.pay)).toBeVisible();
    await expect(visibleText(page, branchName)).toBeVisible();
    await expect(page.getByRole("heading", { name: "خلاصه پرداخت" })).toBeVisible();
    await expect(page.getByRole("link", { name: "ادامه پرداخت" })).toHaveAttribute(
      "href",
      `/appointments/${refs.pay}/payment`,
    );
  });

  test("payment redirects to the allowed gateway (intercepted, no transaction)", async () => {
    const gatewayRequests: string[] = [];
    await page.route(`${GATEWAY}/**`, async (route) => {
      gatewayRequests.push(route.request().url());
      await route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>gateway stub</body></html>" });
    });

    await page.goto(`/appointments/${refs.pay}`);
    await page.getByRole("link", { name: "ادامه پرداخت" }).click();
    await expect(page).toHaveURL(new RegExp(`/appointments/${refs.pay}/payment$`));
    await page.getByRole("button", { name: "پرداخت آنلاین" }).click();
    await page.waitForURL((url) => url.origin === GATEWAY);
    expect(gatewayRequests).toHaveLength(1);
    expect(gatewayRequests[0]).toMatch(new RegExp(`^${GATEWAY}/pay/`));

    await page.goto("/booking/payment/result");
    await expect(page.getByRole("heading", { name: "در حال بررسی پرداخت" })).toBeVisible();
    await expect(page.getByText("پرداخت با موفقیت تأیید شد")).toHaveCount(0);
    await page.unroute(`${GATEWAY}/**`);
  });

  test("cancel an appointment and find it under cancelled", async () => {
    await page.goto(`/appointments/${refs.cancel}/cancel`);
    await page.getByRole("button", { name: "لغو نوبت" }).click();
    await expect(page.getByRole("heading", { name: "نوبت شما لغو شد." })).toBeVisible();
    await page.getByRole("link", { name: "نوبت‌های لغوشده" }).click();
    await expect(visibleText(page, refs.cancel)).toBeVisible();
  });

  test("reschedule an appointment to an open slot", async () => {
    const target = await nextOpenSlot((slot) => slot.date !== bookedDay);
    await page.goto(`/appointments/${refs.reschedule}/reschedule`);
    await pickRescheduleSlot(page, target);
    await acknowledgeIfRequired(page);
    await page.getByRole("button", { name: "تأیید زمان‌بندی مجدد" }).click();
    await expect(page.getByRole("heading", { name: "زمان‌بندی مجدد انجام شد." })).toBeVisible();

    const view = page.getByRole("link", { name: "مشاهده نوبت" });
    const href = await view.getAttribute("href");
    expect(href).toMatch(/^\/appointments\/[^/]+$/);
    expect(href).not.toBe(`/appointments/${refs.reschedule}`);
    await view.click();
    await expect(visibleText(page, href!.split("/").pop()!)).toBeVisible();
  });

  test("availability conflict: a slot taken by another customer is rejected and cleared", async () => {
    const contested = await nextOpenSlot((slot) => slot.date !== bookedDay);
    await page.goto(`/appointments/${refs.conflict}/reschedule`);
    await pickRescheduleSlot(page, contested);
    await acknowledgeIfRequired(page);

    await registerCustomer(api, rivalMobile, password, `رقیب ${runId}`);
    await book(api, await apiAuth(api, rivalMobile), contested);

    await page.getByRole("button", { name: "تأیید زمان‌بندی مجدد" }).click();
    await expect(visibleText(page, "تغییر در شرایط")).toBeVisible();
    await expect(visibleText(page, "این زمان دیگر در دسترس نیست.")).toBeVisible();
    await expect(
      page.locator(`input[name="booking-slot"][value="${slotRadioValue(contested.start)}"]`),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "تأیید زمان‌بندی مجدد" })).toBeDisabled();
  });
});
