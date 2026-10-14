import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { loginAsOwner } from "./support/auth";
import { apiAuth, backend, type AuthHeaders } from "./support/backend";
import { e2eEnv, runId } from "./support/env";

/**
 * Resource flows that need an existing resource: service resource mapping and resource
 * blocking. Each test arranges its own run-unique records in the throwaway database and
 * confirms the outcome by reading the Backend, not only the UI.
 */

let api: APIRequestContext;
let auth: AuthHeaders;

async function data<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { data: T }).data;
}

async function roomTypeId(): Promise<string> {
  const types = await data<{ id: string; code: string }[]>(await api.get("resources/types", { headers: auth }));
  const room = types.find((type) => type.code === "room");
  expect(room, "seeded resource types include room").toBeTruthy();
  return room!.id;
}

async function createRoom(name: string): Promise<string> {
  const room = await data<{ id: string }>(
    await api.post("resources", {
      headers: auth,
      data: { resource_type_id: await roomTypeId(), name, branch_ids: [e2eEnv.branchId] },
    }),
  );
  return room.id;
}

/** Opens a date field's calendar and picks the cell whose day label starts with `dayName`. */
async function pickDay(page: Page, field: string, dayName: string) {
  await page.getByRole("combobox", { name: field }).click();
  const dialog = page.getByRole("dialog");
  for (let step = 0; step < 3; step += 1) {
    const cell = dialog.getByRole("gridcell", { name: new RegExp(`^${dayName}`) });
    if (await cell.count()) {
      await cell.first().click();
      return;
    }
    await dialog.getByRole("button", { name: "ماه بعد" }).click();
  }
  throw new Error(`day ${dayName} not reachable in the ${field} calendar`);
}

test.beforeAll(async () => {
  api = await backend();
  auth = await apiAuth(api, e2eEnv.ownerMobile, e2eEnv.ownerPassword);
});

test.afterAll(async () => {
  await api.dispose();
});

test.describe("admin resources", () => {
  test("service resource mapping: pin a room and save the Backend requirement", async ({ page }) => {
    const roomName = `اتاق نگاشت ${runId}`;
    const roomId = await createRoom(roomName);
    const service = await data<{ id: string }>(
      await api.post("services", {
        headers: auth,
        data: { title: `خدمت نگاشت ${runId}`, duration_minutes: 30, price: "100000", status: "active" },
      }),
    );

    await loginAsOwner(page);
    await page.goto(`/admin/services/${service.id}/resources`);
    await page.getByRole("button", { name: "افزودن نیازمندی" }).click();
    await page.getByRole("button", { name: "نوع منبع" }).click();
    await page.getByRole("option", { name: "اتاق", exact: true }).click();
    await page.getByRole("button", { name: "حالت انتخاب" }).click();
    await page.getByRole("option", { name: "منابع مشخص" }).click();
    await page.getByRole("button", { name: "منابع مشخص" }).click();
    await page.getByRole("option", { name: roomName }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "ذخیره نیازمندی‌ها" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "تأیید و ذخیره" }).click();
    await expect(page.getByRole("paragraph").filter({ hasText: "نیازمندی‌های منبع ذخیره شد." })).toBeVisible();

    const saved = await data<{ requirements: { specific_resource_id: string | null; is_required: boolean }[] }>(
      await api.get(`services/${service.id}/resource-requirements`, { headers: auth }),
    );
    expect(saved.requirements).toHaveLength(1);
    expect(saved.requirements[0]).toMatchObject({ specific_resource_id: roomId, is_required: true });

    await page.reload();
    await expect(page.getByText(roomName).filter({ visible: true }).first()).toBeVisible();
  });

  test("block a resource for a day, then release it", async ({ page }) => {
    const roomId = await createRoom(`اتاق مسدودی ${runId}`);
    const reason = `تعمیر ${runId}`;

    await loginAsOwner(page);
    await page.goto(`/admin/schedules/resources/${roomId}`);
    await page.getByRole("tab", { name: "مسدودی" }).click();

    await page.getByRole("combobox", { name: "شروع" }).click();
    const startDialog = page.getByRole("dialog");
    await startDialog.getByRole("button", { name: "ماه بعد" }).click();
    const startCell = startDialog.locator('[role="gridcell"]:not([aria-disabled="true"])').nth(9);
    const dayName = ((await startCell.getAttribute("aria-label")) ?? "").split("،")[0]!.trim();
    expect(dayName).not.toBe("");
    await startCell.click();
    await pickDay(page, "پایان", dayName);

    await page.getByRole("textbox", { name: /دلیل/ }).fill(reason);
    await page.getByRole("button", { name: /ثبت مسدودی/ }).click();
    await page.getByRole("dialog", { name: "تأیید تغییر" }).getByRole("button", { name: "ذخیره" }).click();
    await expect(page.getByText(reason)).toBeVisible();

    type Block = { id: string; reason: string; starts_at: string; ends_at: string };
    const active = await data<Block[]>(
      await api.get(`resources/${roomId}/blocked-times?active_only=true`, { headers: auth }),
    );
    expect(active.map((block) => block.reason)).toEqual([reason]);
    const hours = (Date.parse(active[0]!.ends_at) - Date.parse(active[0]!.starts_at)) / 3_600_000;
    expect(hours).toBe(24);

    await page.getByRole("button", { name: "رفع مسدودی" }).click();
    await page.getByRole("dialog", { name: "تأیید تغییر" }).getByRole("button", { name: "ذخیره" }).click();
    await expect(page.getByText(reason)).toHaveCount(0);
    const afterRelease = await data<Block[]>(
      await api.get(`resources/${roomId}/blocked-times?active_only=true`, { headers: auth }),
    );
    expect(afterRelease).toEqual([]);
  });
});
