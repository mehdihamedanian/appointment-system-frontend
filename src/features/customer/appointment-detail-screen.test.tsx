import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { AppointmentDetailScreen } from "@/features/customer/appointment-detail-screen";
import { ApiError } from "@/lib/api/errors";
import { clearFrontendCaches } from "@/lib/auth/session";
import { queryKeys } from "@/lib/query/keys";
import {
  createSessionValue,
  renderWithProviders,
} from "@/test/render";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/appointments/apt_detail_1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

const detailPayload = {
  id: "apt_detail_1",
  publicReference: "apt_detail_1",
  status: "confirmed",
  service: { id: "svc_1", name: "ویزیت", publicDescription: "توضیح خدمت" },
  provider: { mode: "specific", id: "prv_1", name: "دکتر نمونه" },
  branch: {
    id: "br_1",
    name: "شعبه مرکزی",
    address: "تهران",
    phone: "02112345678",
    directionsUrl: "https://maps.example/place",
  },
  singleBranch: true,
  startsAt: "2026-08-22T09:00:00+03:30",
  endsAt: "2026-08-22T09:30:00+03:30",
  timezone: "Asia/Tehran",
  durationMinutes: 30,
  paymentStatus: "paid",
  pricing: {
    totalAmount: { label: "۲۵۰٬۰۰۰ تومان" },
    paidAmount: { label: "۲۵۰٬۰۰۰ تومان" },
  },
  customerNote: "یادداشت <script>alert(1)</script> مشتری",
  internalNote: "محرمانه",
  timeline: [{ id: "evt_1", title: "ثبت نوبت", state: "complete" }],
  cancellationPolicy: { summary: "تا ۲۴ ساعت قبل" },
  contact: { phone: "02187654321", email: "info@example.com" },
  actions: {
    canView: true,
    canCancel: true,
    canReschedule: true,
    canRepeat: true,
    canPay: false,
  },
};

async function waitForLoadedAppointment() {
  expect((await screen.findAllByText("تأییدشده")).length).toBeGreaterThan(0);
}

const clipboardWrite = vi.fn().mockResolvedValue(undefined);

describe("AppointmentDetailScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    push.mockReset();
    document.documentElement.dir = "rtl";
    clipboardWrite.mockReset();
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: clipboardWrite },
    });
  });

  it("does not fetch before session restoration", () => {
    renderWithProviders(<AppointmentDetailScreen reference="apt_detail_1" />, {
      session: createSessionValue({ status: "loading", user: null }),
    });
    expect(mockedClient).not.toHaveBeenCalled();
    expect(screen.getByLabelText("در حال بارگذاری جزئیات نوبت")).toBeInTheDocument();
  });

  it("renders appointment snapshots and booking reference copy", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/timeline")) {
        return { events: [] };
      }
      return detailPayload;
    });
    renderWithProviders(<AppointmentDetailScreen reference="apt_detail_1" />);
    await waitForLoadedAppointment();
    expect(screen.getAllByText("ویزیت").length).toBeGreaterThan(0);
    expect(screen.getAllByText("پرداخت‌شده").length).toBeGreaterThan(0);
    expect(screen.getAllByText("دکتر نمونه").length).toBeGreaterThan(0);
    expect(screen.getByText("محل مراجعه")).toBeInTheDocument();
    expect(screen.getByText("یادداشت مشتری")).toBeInTheDocument();
    expect(screen.queryByText("محرمانه")).not.toBeInTheDocument();
    expect(screen.getByText("ثبت نوبت")).toBeInTheDocument();
    expect(screen.getByText("تماس با مجموعه")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ارسال ایمیل" })).toHaveAttribute(
      "href",
      "mailto:info@example.com",
    );
    const copyButton = screen.getAllByRole("button", { name: "رونوشت کد رزرو" })[0];
    await userEvent.click(copyButton!);
    expect(clipboardWrite).toHaveBeenCalledWith("apt_detail_1");
  });

  it("shows the same not-found state for forbidden and missing appointments", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 403, message: "Forbidden" }));
    renderWithProviders(<AppointmentDetailScreen reference="apt_missing" />);
    expect(await screen.findByRole("heading", { name: "نوبت پیدا نشد" })).toBeInTheDocument();
  });

  it("shows session expired state", async () => {
    mockedClient.mockRejectedValue(
      new ApiError({ status: 401, code: "SESSION_EXPIRED", message: "expired" }),
    );
    renderWithProviders(<AppointmentDetailScreen reference="apt_detail_1" />);
    expect(await screen.findAllByText(/نشست شما پایان یافته/)).not.toHaveLength(0);
  });

  it("keeps main data when timeline fetch fails", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/timeline")) {
        throw new ApiError({ status: 500, message: "timeline down" });
      }
      return { ...detailPayload, timeline: undefined };
    });
    renderWithProviders(<AppointmentDetailScreen reference="apt_detail_1" />);
    await waitForLoadedAppointment();
    expect(screen.getAllByText("ویزیت").length).toBeGreaterThan(0);
    expect(await screen.findByText("تاریخچه وضعیت دریافت نشد")).toBeInTheDocument();
    expect(screen.queryByText("ثبت نوبت")).toBeNull();
  });

  it("links to cancellation when Backend allows it", async () => {
    mockedClient.mockResolvedValue(detailPayload);
    renderWithProviders(<AppointmentDetailScreen reference="apt_detail_1" />);
    await waitForLoadedAppointment();
    expect(screen.getAllByRole("link", { name: "لغو نوبت" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "لغو نوبت" })[0]).toHaveAttribute(
      "href",
      "/appointments/apt_detail_1/cancel",
    );
    expect(screen.getAllByRole("link", { name: "زمان‌بندی مجدد" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "زمان‌بندی مجدد" })[0]).toHaveAttribute(
      "href",
      "/appointments/apt_detail_1/reschedule",
    );
  });

  it("shows repeat booking when Backend allows it", async () => {
    mockedClient.mockResolvedValue(detailPayload);
    renderWithProviders(<AppointmentDetailScreen reference="apt_detail_1" />);
    expect(await screen.findAllByRole("button", { name: "رزرو دوباره" })).not.toHaveLength(0);
  });

  it("scopes detail cache per customer and clears on logout", async () => {
    mockedClient.mockResolvedValue(detailPayload);
    const queryClient = new QueryClient();
    renderWithProviders(<AppointmentDetailScreen reference="apt_detail_1" />, { queryClient });
    await waitForLoadedAppointment();
    expect(
      queryClient.getQueryData(queryKeys.customer.appointmentDetail("user_1", "apt_detail_1")),
    ).toBeTruthy();
    clearFrontendCaches(queryClient);
    expect(
      queryClient.getQueryData(queryKeys.customer.appointmentDetail("user_1", "apt_detail_1")),
    ).toBeUndefined();
  });

  it("rejects unsafe reference tokens", () => {
    renderWithProviders(<AppointmentDetailScreen reference="../secret" />);
    expect(screen.getByRole("heading", { name: "نوبت پیدا نشد" })).toBeInTheDocument();
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it("maps pending assignment provider label", async () => {
    mockedClient.mockResolvedValue({
      ...detailPayload,
      provider: { mode: "pending_assignment" },
    });
    renderWithProviders(<AppointmentDetailScreen reference="apt_detail_1" />);
    expect((await screen.findAllByText("متخصص توسط مجموعه تعیین می‌شود")).length).toBeGreaterThan(0);
  });

  it("exposes a keyboard-focusable copy control", async () => {
    mockedClient.mockResolvedValue(detailPayload);
    renderWithProviders(<AppointmentDetailScreen reference="apt_detail_1" />);
    await waitForLoadedAppointment();
    const copyButton = screen.getAllByRole("button", { name: "رونوشت کد رزرو" })[0]!;
    copyButton.focus();
    expect(copyButton).toHaveFocus();
    fireEvent.click(copyButton);
    await waitFor(() => {
      expect(clipboardWrite).toHaveBeenCalledWith("apt_detail_1");
    });
  });
});
