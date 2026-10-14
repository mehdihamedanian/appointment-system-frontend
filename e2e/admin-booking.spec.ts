import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { loginAsOwner } from "./support/auth";
import {
  apiAuth,
  availableSlots,
  backend,
  nextOpenSlot,
  registerCustomer,
  type AuthHeaders,
  type Slot,
} from "./support/backend";
import { e2eEnv, runId } from "./support/env";

/**
 * Admin manual booking against the isolated Backend. The branch is chosen from the branches
 * of staff qualified for the service (the Backend has no branch list); results are read back
 * from the Backend, not only from the UI.
 */

const password = "E2e-Manual-Pass-1";
const stamp = String(Date.now()).slice(-7);
const customerMobile = `0915${stamp}`;
const customerLastName = `دستی ${runId}`;

let api: APIRequestContext;
let owner: AuthHeaders;

async function data<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { data: T }).data;
}

/** Customer, service and branch, then the slot; stops on the resource allocation step. */
async function walkToResources(page: Page, serviceName: string, slot: Slot) {
  await loginAsOwner(page);
  await page.goto("/admin/bookings/new");
  await page.getByRole("combobox", { name: "جستجوی مشتری" }).fill(customerLastName);
  await page.getByRole("option", { name: new RegExp(customerLastName) }).click();
  await page.getByRole("button", { name: "مرحله بعد" }).click();

  await page.getByRole("radio", { name: new RegExp(serviceName) }).check();
  await page.getByRole("group", { name: "انتخاب شعبه" }).getByRole("radio", { name: /E2E Branch/ }).check();
  await page.getByRole("button", { name: "مرحله بعد" }).click();
  await page.getByRole("button", { name: "مرحله بعد" }).click();

  const day = page.locator(`[role="gridcell"][data-date="${slot.date}"]`);
  await expect(page.locator('[role="gridcell"][data-date]').first()).toBeVisible();
  if ((await day.count()) === 0) {
    await page.getByRole("button", { name: "ماه بعد" }).click();
  }
  await day.click();
  await page.locator(`input[name="booking-slot"][value="slot_${Date.parse(slot.start)}"]`).check();
  await page.getByRole("button", { name: "مرحله بعد" }).click();
}

async function submitFromResources(page: Page) {
  await page.getByRole("button", { name: "مرحله بعد" }).click();
  await page.getByRole("button", { name: "مرحله بعد" }).click();
  await expect(page.getByRole("heading", { name: "بررسی و تأیید" })).toBeVisible();
  await page.getByRole("button", { name: "ثبت نوبت" }).click();
  await expect(page.getByRole("heading", { name: "نوبت ثبت شد" })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  api = await backend();
  await registerCustomer(api, customerMobile, password, customerLastName);
  owner = await apiAuth(api, e2eEnv.ownerMobile, e2eEnv.ownerPassword);
});

test.afterAll(async () => {
  await api.dispose();
});

test("admin: manual appointment for an existing customer", async ({ page }) => {
  const slot = await nextOpenSlot(api, owner);
  await walkToResources(page, "E2E Fixture Service", slot);
  await expect(page.getByRole("heading", { name: "تخصیص خودکار" })).toBeVisible();
  await submitFromResources(page);

  const customer = await apiAuth(api, customerMobile, password);
  const upcoming = await data<{ items: { starts_at: string; branch: { id: string }; booking_source: string }[] }>(
    await api.get("appointments/me/upcoming", { headers: customer }),
  );
  const booked = upcoming.items.find((item) => Date.parse(item.starts_at) === Date.parse(slot.start));
  expect(booked, JSON.stringify(upcoming.items)).toBeDefined();
  expect(booked?.branch.id).toBe(e2eEnv.branchId);
  expect(booked?.booking_source).not.toBe("customer_online");
});

test("admin: manual appointment with a chosen room", async ({ page }) => {
  const types = await data<{ id: string; code: string }[]>(await api.get("resources/types", { headers: owner }));
  const typeId = (code: string) => types.find((type) => type.code === code)!.id;
  const createRoom = async (name: string) =>
    (
      await data<{ id: string }>(
        await api.post("resources", {
          headers: owner,
          data: { resource_type_id: typeId("room"), name, branch_ids: [e2eEnv.branchId] },
        }),
      )
    ).id;
  const firstRoom = await createRoom(`اتاق الف ${runId}`);
  const secondRoomName = `اتاق ب ${runId}`;
  const secondRoom = await createRoom(secondRoomName);

  const serviceName = `خدمت اتاق ${runId}`;
  const service = await data<{ id: string }>(
    await api.post("services", {
      headers: owner,
      data: { title: serviceName, duration_minutes: 30, price: "120000", status: "active" },
    }),
  );
  const staff = await data<{ items: { id: string; first_name: string }[] }>(
    await api.get("staff?page_size=100&is_active=true", { headers: owner }),
  );
  const sara = staff.items.find((item) => item.first_name === "Sara");
  expect(sara, "fixture staff Sara exists").toBeTruthy();
  const link = await api.post(`staff/${sara!.id}/services/${service.id}`, { headers: owner });
  expect(link.ok(), await link.text()).toBe(true);
  await data(
    await api.put(`services/${service.id}/resource-requirements`, {
      headers: owner,
      data: {
        requirements: [
          { resource_type_id: typeId("staff"), quantity: 1, is_required: true, sort_order: 1 },
          {
            resource_type_id: typeId("room"),
            alternative_resource_ids: [firstRoom, secondRoom],
            quantity: 1,
            is_required: true,
            label: "اتاق درمان",
            sort_order: 2,
          },
        ],
      },
    }),
  );
  const slot = (await availableSlots(api, owner, service.id))[0];
  expect(slot, "the room service has an open slot in the next 6 days").toBeTruthy();

  await walkToResources(page, serviceName, slot!);
  await page.getByRole("radio", { name: /^انتخاب از منابع معتبر/ }).check();
  await page.getByRole("group", { name: "اتاق درمان" }).getByRole("radio", { name: secondRoomName }).check();
  await submitFromResources(page);

  const list = await data<{ items: { booking_reference: string; starts_at: string }[] }>(
    await api.get(`admin/appointments?service_id=${service.id}`, { headers: owner }),
  );
  const booked = list.items.find((item) => Date.parse(item.starts_at) === Date.parse(slot!.start));
  expect(booked, JSON.stringify(list.items)).toBeDefined();
  const detail = await data<{ reserved_resources: { resource_id: string }[] }>(
    await api.get(`admin/appointments/${booked!.booking_reference}`, { headers: owner }),
  );
  const rooms = detail.reserved_resources.filter((item) => item.resource_id === firstRoom || item.resource_id === secondRoom);
  expect(rooms.map((item) => item.resource_id)).toEqual([secondRoom]);
});
