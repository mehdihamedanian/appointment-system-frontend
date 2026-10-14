import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { AppointmentRescheduleScreen } from "@/features/customer/appointment-reschedule-screen";
import { ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query/keys";
import {
  createSessionValue,
  renderWithProviders,
} from "@/test/render";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/appointments/apt_resched_1/reschedule",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

const previewPayload = {
  canReschedule: true,
  previewVersion: "pv_1",
  appointment: {
    publicReference: "apt_resched_1",
    status: "confirmed",
    service: { id: "svc_1", name: "ویزیت" },
    startsAt: "2026-08-22T09:00:00+03:30",
    timezone: "Asia/Tehran",
    provider: { mode: "specific", id: "prv_1", name: "دکتر نمونه" },
    branch: { id: "br_1", name: "شعبه مرکزی" },
    internalNote: "محرمانه",
  },
  selection: {
    serviceId: "svc_1",
    branchId: "br_1",
    providerPreference: { type: "specific", providerId: "prv_1" },
    requiresBranch: true,
    providerMode: "optional",
  },
  permissions: { allowBranchChange: false, allowProviderChange: false },
  policy: { summary: "یک بار رایگان" },
};

/** `GET /services/{id}/availability`; 2026-08-25 09:00 Tehran (+03:30). */
const availabilityPayload = {
  timezone: "Asia/Tehran",
  configuration_valid: true,
  days: [
    {
      date: "2026-08-25",
      slots: [{ start: "2026-08-25T05:30:00Z", end: "2026-08-25T06:00:00Z" }],
    },
  ],
};

const quotePayload = {
  previewVersion: "pv_2",
  appointment: previewPayload.appointment,
  proposed: {
    slotId: `slot_${Date.parse("2026-08-25T05:30:00Z")}`,
    date: "2026-08-25",
    startsAt: "2026-08-25T09:00:00+03:30",
  },
  financial: { status: "none" },
  policy: { summary: "یک بار رایگان" },
};

// 2026-08-25 is 3 Shahrivar 1405 in the Jalali grid.
const TARGET_DAY = /^3 شهریور.*قابل/;
const SLOT_LABEL = /0?9:00|۰?۹:۰۰/;

describe("AppointmentRescheduleScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    push.mockReset();
    document.documentElement.dir = "rtl";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-24T08:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not fetch before session restoration", () => {
    renderWithProviders(<AppointmentRescheduleScreen reference="apt_resched_1" />, {
      session: createSessionValue({ status: "loading", user: null }),
    });
    expect(mockedClient).not.toHaveBeenCalled();
    expect(screen.getByLabelText("در حال بارگذاری زمان‌بندی مجدد")).toBeInTheDocument();
  });

  it("renders ineligible state from backend preview", async () => {
    mockedClient.mockResolvedValue({
      ...previewPayload,
      canReschedule: false,
      blockedReason: "مهلت زمان‌بندی مجدد گذشته است",
    });
    renderWithProviders(<AppointmentRescheduleScreen reference="apt_resched_1" />);
    expect(await screen.findByText("زمان‌بندی مجدد مجاز نیست")).toBeInTheDocument();
    expect(screen.getByText("مهلت زمان‌بندی مجدد گذشته است")).toBeInTheDocument();
    expect(screen.queryByText("محرمانه")).not.toBeInTheDocument();
  });

  it("loads calendar and slots from reschedule availability endpoints", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path.includes("reschedule-preview")) return previewPayload;
      if (path.endsWith("/availability")) return availabilityPayload;
      if (path.includes("/quote")) return quotePayload;
      throw new ApiError({ status: 404, message: "missing" });
    });
    const user = userEvent.setup();
    renderWithProviders(<AppointmentRescheduleScreen reference="apt_resched_1" />);
    await screen.findByText("نوبت فعلی");
    await user.click(await screen.findByRole("gridcell", { name: TARGET_DAY }));
    expect(await screen.findByRole("radio", { name: SLOT_LABEL })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: SLOT_LABEL }));
    expect(await screen.findByText("مقایسه زمان نوبت")).toBeInTheDocument();
  });

  it("submits reschedule with idempotency and shows success", async () => {
    mockedClient.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path.includes("reschedule-preview")) return previewPayload;
      if (path.endsWith("/availability")) return availabilityPayload;
      if (path.includes("/quote")) return quotePayload;
      if (options?.method === "POST" && path.endsWith("/reschedule")) {
        return {
          appointmentReference: "apt_resched_1",
          status: "rescheduled",
          startsAt: "2026-08-25T09:00:00+03:30",
          financial: { status: "none" },
        };
      }
      throw new ApiError({ status: 404, message: "missing" });
    });
    const user = userEvent.setup();
    renderWithProviders(<AppointmentRescheduleScreen reference="apt_resched_1" />);
    await screen.findByText("نوبت فعلی");
    await user.click(await screen.findByRole("gridcell", { name: TARGET_DAY }));
    await user.click(await screen.findByRole("radio", { name: SLOT_LABEL }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "تأیید زمان‌بندی مجدد" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "تأیید زمان‌بندی مجدد" }));
    expect(await screen.findByRole("heading", { name: "زمان‌بندی مجدد انجام شد." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "مشاهده نوبت" })).toHaveAttribute(
      "href",
      "/appointments/apt_resched_1",
    );
  });

  it("clears slot on conflict and shows message", async () => {
    mockedClient.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path.includes("reschedule-preview")) return previewPayload;
      if (path.endsWith("/availability")) return availabilityPayload;
      if (path.includes("/quote")) return quotePayload;
      if (options?.method === "POST" && path.endsWith("/reschedule")) {
        throw new ApiError({ status: 409, code: "SLOT_TAKEN", message: "taken" });
      }
      throw new ApiError({ status: 404, message: "missing" });
    });
    const user = userEvent.setup();
    renderWithProviders(<AppointmentRescheduleScreen reference="apt_resched_1" />);
    await screen.findByText("نوبت فعلی");
    await user.click(await screen.findByRole("gridcell", { name: TARGET_DAY }));
    await user.click(await screen.findByRole("radio", { name: SLOT_LABEL }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "تأیید زمان‌بندی مجدد" })).toBeEnabled();
    });
    const availabilityCalls = () =>
      mockedClient.mock.calls.filter(([path]) => String(path).endsWith("/availability")).length;
    const before = availabilityCalls();
    await user.click(screen.getByRole("button", { name: "تأیید زمان‌بندی مجدد" }));
    expect(await screen.findByText("تغییر در شرایط")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: SLOT_LABEL })).not.toBeChecked();
    await waitFor(() => expect(availabilityCalls()).toBeGreaterThan(before));
  });

  it("invalidates caches after success", async () => {
    mockedClient.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path.includes("reschedule-preview")) return previewPayload;
      if (path.endsWith("/availability")) return availabilityPayload;
      if (path.includes("/quote")) return quotePayload;
      if (options?.method === "POST" && path.endsWith("/reschedule")) {
        return {
          appointmentReference: "apt_resched_1",
          status: "rescheduled",
          startsAt: "2026-08-25T09:00:00+03:30",
          financial: { status: "none" },
        };
      }
      throw new ApiError({ status: 404, message: "missing" });
    });
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();
    renderWithProviders(<AppointmentRescheduleScreen reference="apt_resched_1" />, { queryClient });
    await screen.findByText("نوبت فعلی");
    await user.click(await screen.findByRole("gridcell", { name: TARGET_DAY }));
    await user.click(await screen.findByRole("radio", { name: SLOT_LABEL }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "تأیید زمان‌بندی مجدد" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "تأیید زمان‌بندی مجدد" }));
    await screen.findByRole("heading", { name: "زمان‌بندی مجدد انجام شد." });
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.customer.appointmentDetail("user_1", "apt_resched_1"),
      }),
    );
  });
});
