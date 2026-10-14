import { expect, request, type APIRequestContext } from "@playwright/test";
import { e2eEnv } from "./env";

/** Direct isolated-Backend calls used to arrange data the frontend cannot create (see README). */

export type Slot = { date: string; start: string };
export type AuthHeaders = Record<string, string>;

export const intlMobile = (mobile: string) => `+98${mobile.slice(1)}`;

export function tehranDate(offsetDays: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );
}

export async function backend(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: `${e2eEnv.backendUrl}/` });
}

export async function registerCustomer(
  api: APIRequestContext,
  mobile: string,
  password: string,
  lastName: string,
) {
  const response = await api.post("auth/register", {
    data: {
      first_name: "مشتری",
      last_name: lastName,
      mobile: intlMobile(mobile),
      password,
      password_confirmation: password,
    },
  });
  expect([200, 201], await response.text()).toContain(response.status());
}

export async function apiAuth(api: APIRequestContext, mobile: string, password: string): Promise<AuthHeaders> {
  const response = await api.post("auth/login", {
    data: { identifier: intlMobile(mobile), password },
  });
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as { data: { access_token: string } };
  return { Authorization: `Bearer ${body.data.access_token}` };
}

export async function availableSlots(
  api: APIRequestContext,
  auth: AuthHeaders,
  serviceId = e2eEnv.serviceId,
): Promise<Slot[]> {
  const query = new URLSearchParams({
    branch_id: e2eEnv.branchId,
    from: tehranDate(1),
    to: tehranDate(6),
  });
  const response = await api.get(`services/${serviceId}/availability?${query}`, { headers: auth });
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as {
    data: { days: { date: string; slots: { start: string }[] }[] };
  };
  return body.data.days.flatMap((day) => day.slots.map((slot) => ({ date: day.date, start: slot.start })));
}

/** Slots overlap (step < duration), so availability is re-read before every booking. */
export async function nextOpenSlot(
  api: APIRequestContext,
  auth: AuthHeaders,
  predicate: (slot: Slot) => boolean = () => true,
): Promise<Slot> {
  const slot = (await availableSlots(api, auth)).find(predicate);
  expect(slot, "the fixture schedule has no open slot left in the next 6 days").toBeTruthy();
  return slot!;
}

export async function book(api: APIRequestContext, auth: AuthHeaders, slot: Slot) {
  const response = await api.post("appointments/me", {
    headers: { ...auth, "Idempotency-Key": crypto.randomUUID() },
    data: { service_id: e2eEnv.serviceId, branch_id: e2eEnv.branchId, start_time: slot.start },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = (await response.json()) as {
    data: { appointment: { booking_reference: string; branch: { name: string } } };
  };
  return { reference: body.data.appointment.booking_reference, branchName: body.data.appointment.branch.name };
}
