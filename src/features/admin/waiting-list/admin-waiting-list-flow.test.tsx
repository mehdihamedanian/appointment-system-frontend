import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminWaitingListScreen } from "@/features/admin/waiting-list/admin-waiting-list-screen";
import { AdminWaitingListDetailScreen } from "@/features/admin/waiting-list/admin-waiting-list-detail-screen";
import { AdminWaitingListOfferScreen } from "@/features/admin/waiting-list/admin-waiting-list-offer-screen";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

/** E2E: Admin opens waiting list → views entry → selects slot → sends offer */

const replaceMock = vi.fn();
const pushMock = vi.fn();
let params = { entryReference: "WLE-1" };

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/waiting-list",
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => params,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

function mockBusiness(waitingList = true) {
  return {
    name: "Test Business",
    bookingEnabled: true,
    waitingListEnabled: waitingList,
    socialLinks: [],
    workingHours: [],
    contactHours: [],
  };
}

async function pickSelectOption(user: ReturnType<typeof userEvent.setup>, fieldId: string, label: string) {
  await waitFor(() => expect(document.getElementById(fieldId)).toBeInTheDocument());
  await user.click(document.getElementById(fieldId)!);
  await user.click(await screen.findByRole("option", { name: label }));
}

function entryDetail(overrides: Record<string, unknown> = {}) {
  return {
    publicReference: "WLE-1",
    status: "active",
    service: { id: "svc_1", name: "ویزیت" },
    customer: { reference: "cust_1", displayName: "علی رضایی" },
    allowedActions: { view: true, sendOffer: true, cancel: true },
    createdAt: "2026-08-22T10:00:00.000Z",
    version: "v1",
    ...overrides,
  };
}

describe("Phase 37 admin waiting-list E2E flow", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replaceMock.mockReset();
    pushMock.mockReset();
    params = { entryReference: "WLE-1" };
  });

  it("walks list → detail → offer preview → authoritative send", async () => {
    const user = userEvent.setup();
    const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });
    let offerSent = false;

    mockedClient.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
      const url = String(path);
      const method = init?.method ?? "GET";
      if (url === "/public/business") return mockBusiness(true);
      if (method === "GET" && url.startsWith("/admin/waiting-list?")) {
        return {
          items: [
            {
              publicReference: "WLE-1",
              status: "active",
              service: { id: "svc_1", name: "ویزیت" },
              customer: { reference: "cust_1", displayName: "علی رضایی" },
              allowedActions: { view: true, sendOffer: true },
              createdAt: "2026-08-22T10:00:00.000Z",
            },
          ],
          totalCount: 1,
          pageCount: 1,
        };
      }
      if (url.includes("/offer-eligibility")) return { eligible: true };
      if (url.includes("/availability/dates")) {
        return { days: [{ date: "2026-08-25", label: "۲۵ مرداد" }] };
      }
      if (url.includes("/availability/slots")) {
        return {
          slots: [{ id: "slot_1", startsAt: "2026-08-25T09:00:00+03:30", label: "۹:۰۰", available: true }],
        };
      }
      if (url.includes("/offer-preview") && method === "POST") {
        const body = init?.body as { expirationOptionId?: string };
        return {
          serviceName: "ویزیت",
          slotLabel: "۹:۰۰",
          expirationOptions: [{ id: "exp_30", label: "۳۰ دقیقه" }],
          defaultExpirationId: "exp_30",
          priceLabel: "۲۵۰٬۰۰۰ تومان",
          previewVersion: body.expirationOptionId ? "pv2" : "pv1",
          nextStepLabel: "مشتری باید پیشنهاد را بپذیرد.",
        };
      }
      if (url.includes("/offers") && method === "POST") {
        offerSent = true;
        return {
          entryReference: "WLE-1",
          offerReference: "WLO-1",
          offerStatus: "pending",
          expiresAt: "2026-08-22T12:00:00.000Z",
          serverNow: "2026-08-22T11:55:00.000Z",
          message: "پیشنهاد ارسال شد",
        };
      }
      if (url.includes("/admin/waiting-list/WLE-1")) {
        return entryDetail(
          offerSent
            ? {
                status: "offered",
                activeOffer: {
                  publicReference: "WLO-1",
                  status: "pending",
                  whenLabel: "۹:۰۰",
                  expiresAt: "2026-08-22T12:00:00.000Z",
                  serverNow: "2026-08-22T11:55:00.000Z",
                },
                allowedActions: { view: true, sendOffer: false },
              }
            : {},
        );
      }
      return {};
    });

    const listView = renderWithProviders(<AdminWaitingListScreen />, { session });
    expect((await screen.findAllByText("علی رضایی")).length).toBeGreaterThan(0);
    listView.unmount();

    params = { entryReference: "WLE-1" };
    const detailView = renderWithProviders(<AdminWaitingListDetailScreen />, { session });
    expect((await screen.findAllByText("علی رضایی")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("link", { name: "ارسال پیشنهاد" })).toBeInTheDocument();
    detailView.unmount();

    renderWithProviders(<AdminWaitingListOfferScreen />, { session });
    await waitFor(() => expect(screen.queryByText("بارگذاری تاریخ‌ها")).not.toBeInTheDocument());
    await pickSelectOption(user, "wl-offer-date", "۲۵ مرداد");
    await pickSelectOption(user, "wl-offer-slot", "۹:۰۰");
    await waitFor(() => expect(screen.getByLabelText("مهلت پاسخ")).toBeInTheDocument());
    await pickSelectOption(user, "wl-offer-expiry", "۳۰ دقیقه");
    await user.click(screen.getByRole("button", { name: "پیش‌نمایش و ارسال" }));
    expect(await screen.findByText(/مشتری باید پیشنهاد را بپذیرد/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ارسال پیشنهاد" }));
    await waitFor(() => expect(offerSent).toBe(true));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/waiting-list/WLE-1"));
  });

  it("clears slot and refetches when slot taken before submission", async () => {
    const user = userEvent.setup();
    const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });
    let slotFetchCount = 0;
    let previewCalls = 0;

    mockedClient.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
      const url = String(path);
      const method = init?.method ?? "GET";
      if (url === "/public/business") return mockBusiness(true);
      if (url.includes("/offer-eligibility")) return { eligible: true };
      if (url.includes("/availability/dates")) {
        return { days: [{ date: "2026-08-25", label: "۲۵ مرداد" }] };
      }
      if (url.includes("/availability/slots")) {
        slotFetchCount += 1;
        return {
          slots: [{ id: "slot_1", startsAt: "2026-08-25T09:00:00+03:30", label: "۹:۰۰", available: true }],
        };
      }
      if (url.includes("/offer-preview") && method === "POST") {
        previewCalls += 1;
        const body = init?.body as { expirationOptionId?: string };
        if (body?.expirationOptionId) {
          throw { status: 409, code: "SLOT_TAKEN", message: "زمان گرفته شد" };
        }
        return {
          serviceName: "ویزیت",
          slotLabel: "۹:۰۰",
          expirationOptions: [{ id: "exp_30", label: "۳۰ دقیقه" }],
          defaultExpirationId: "exp_30",
        };
      }
      if (url.includes("/admin/waiting-list/WLE-1")) return entryDetail();
      return {};
    });

    renderWithProviders(<AdminWaitingListOfferScreen />, { session });
    await waitFor(() => expect(screen.queryByText("بارگذاری تاریخ‌ها")).not.toBeInTheDocument());
    await pickSelectOption(user, "wl-offer-date", "۲۵ مرداد");
    await pickSelectOption(user, "wl-offer-slot", "۹:۰۰");
    await waitFor(() => expect(screen.queryByText("بارگذاری گزینه‌های انقضا")).not.toBeInTheDocument());
    await pickSelectOption(user, "wl-offer-expiry", "۳۰ دقیقه");
    await user.click(screen.getByRole("button", { name: "پیش‌نمایش و ارسال" }));
    expect(await screen.findByText(/زمان دیگر در دسترس نیست/i)).toBeInTheDocument();
    await waitFor(() => expect(slotFetchCount).toBeGreaterThan(1));
    expect(screen.queryByRole("button", { name: "ارسال پیشنهاد" })).not.toBeInTheDocument();
  });

  it("shows feature disabled when capability is off", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path) === "/public/business") return mockBusiness(false);
      return {};
    });
    const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });
    renderWithProviders(<AdminWaitingListScreen />, { session });
    expect(await screen.findByText(/لیست انتظار غیرفعال/i)).toBeInTheDocument();
  });
});
