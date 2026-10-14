import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { WaitingListScreen } from "@/features/customer/waiting-list-screen";
import { WaitingListJoinScreen } from "@/features/customer/waiting-list-join-screen";
import { WaitingListOfferScreen } from "@/features/customer/waiting-list-offer-screen";
import { WaitingListEntryScreen } from "@/features/customer/waiting-list-entry-screen";
import { OfferCountdown } from "@/features/customer/offer-countdown";
import { TimeStep } from "@/features/booking/steps/time-step";
import { ApiError } from "@/lib/api/errors";
import { createSessionValue, renderWithProviders } from "@/test/render";
import * as capabilities from "@/config/capabilities";

const push = vi.fn();
const replace = vi.fn();
const search = { current: new URLSearchParams() };
const params = { current: {} as Record<string, string> };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/waiting-list",
  useSearchParams: () => search.current,
  useParams: () => params.current,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

function entryPayload(id = "wle_1", overrides: Record<string, unknown> = {}) {
  return {
    publicReference: id,
    status: "active",
    service: { id: "svc_1", name: "ویزیت عمومی" },
    providerPreference: { type: "any" },
    datePreference: { mode: "specific", date: "2026-08-25" },
    timePreference: "morning",
    createdAt: "2026-08-22T10:00:00.000Z",
    canLeave: true,
    ...overrides,
  };
}

function offerPayload(overrides: Record<string, unknown> = {}) {
  return {
    publicReference: "wlo_1",
    entryReference: "wle_1",
    status: "pending",
    service: { name: "ویزیت عمومی" },
    startsAt: "2026-08-25T09:00:00+03:30",
    expiresAt: "2099-08-22T12:00:00.000Z",
    serverNow: "2026-08-22T11:00:00.000Z",
    durationMinutes: 30,
    priceLabel: "۲۵۰٬۰۰۰ تومان",
    canAccept: true,
    canReject: true,
    rejectKeepsEntryActive: true,
    ...overrides,
  };
}

describe("WaitingListScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    push.mockReset();
    replace.mockReset();
    search.current = new URLSearchParams();
    params.current = {};
    document.documentElement.dir = "rtl";
    vi.spyOn(capabilities, "isCapabilityVisible").mockReturnValue(true);
  });

  it("hides the feature when capability is not visible", () => {
    vi.spyOn(capabilities, "isCapabilityVisible").mockReturnValue(false);
    renderWithProviders(<WaitingListScreen />);
    expect(screen.getByText("لیست انتظار فعال نیست")).toBeInTheDocument();
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it("does not fetch before the session is ready", () => {
    renderWithProviders(<WaitingListScreen />, {
      session: createSessionValue({ status: "unauthenticated", user: null }),
    });
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it("renders empty and list states", async () => {
    mockedClient.mockResolvedValueOnce({ items: [] });
    renderWithProviders(<WaitingListScreen />);
    expect(await screen.findByText("درخواست فعالی ندارید")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "پیوستن به لیست انتظار" })[0]).toHaveAttribute(
      "href",
      "/waiting-list/join",
    );

    mockedClient.mockResolvedValueOnce({
      items: [
        entryPayload("wle_1"),
        entryPayload("wle_2", {
          status: "offered",
          activeOffer: { publicReference: "wlo_9", status: "pending" },
        }),
      ],
    });
    renderWithProviders(<WaitingListScreen />);
    expect(await screen.findAllByText("ویزیت عمومی")).not.toHaveLength(0);
    expect(screen.getByRole("link", { name: "مشاهده پیشنهاد" })).toHaveAttribute(
      "href",
      "/waiting-list/offers/wlo_9",
    );
  });

  it("shows API error with retry", async () => {
    mockedClient.mockRejectedValueOnce(
      new ApiError({ status: 500, code: "SERVER", message: "خطای موقت", requestId: "req_wl" }),
    );
    renderWithProviders(<WaitingListScreen />);
    expect(await screen.findByText("لیست انتظار بارگذاری نشد")).toBeInTheDocument();
    expect(screen.getByText(/req_wl/)).toBeInTheDocument();
  });
});

describe("WaitingListJoinScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replace.mockReset();
    search.current = new URLSearchParams("service=svc_1&date=2026-08-25");
    document.documentElement.dir = "rtl";
    vi.spyOn(capabilities, "isCapabilityVisible").mockReturnValue(true);
  });

  it("validates required service and blocks ineligible contexts", async () => {
    const user = userEvent.setup();
    search.current = new URLSearchParams();
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/services")) {
        return { items: [{ id: "svc_1", name: "ویزیت", bookingEnabled: true, pricing: {} }] };
      }
      if (String(path).includes("eligibility")) {
        return { eligible: false, reason: "این خدمت لیست انتظار ندارد." };
      }
      return {};
    });
    renderWithProviders(<WaitingListJoinScreen />);
    expect(
      await screen.findByText(/پیوستن به لیست انتظار نوبت ایجاد نمی‌کند/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ثبت درخواست لیست انتظار" }));
    expect(screen.getByText("خدمت را انتخاب کنید.")).toBeInTheDocument();
  });

  it("submits join once with idempotency and preserves values on failure", async () => {
    const user = userEvent.setup();
    mockedClient.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (String(path).includes("/services") || String(path).includes("catalog")) {
        return {
          items: [
            {
              id: "svc_1",
              name: "ویزیت",
              bookingEnabled: true,
              pricing: { amountLabel: "۱۰۰٬۰۰۰" },
              availability: "bookable",
            },
          ],
        };
      }
      if (String(path).includes("eligibility")) {
        return { eligible: true };
      }
      if (String(path).includes("providers")) {
        return { items: [], mode: "optional", allowAny: true };
      }
      if (options?.method === "POST") {
        throw new ApiError({
          status: 409,
          code: "DUPLICATE_WAITING_LIST",
          message: "درخواست مشابهی از قبل وجود دارد.",
        });
      }
      return {};
    });
    renderWithProviders(<WaitingListJoinScreen />);
    expect(await screen.findByLabelText(/خدمت/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ثبت درخواست لیست انتظار" }));
    expect(await screen.findByText(/درخواست مشابهی از قبل وجود دارد/)).toBeInTheDocument();
    expect(screen.getByText(/پیوستن به لیست انتظار نوبت ایجاد نمی‌کند/)).toBeInTheDocument();
    const posts = mockedClient.mock.calls.filter((call) => call[1]?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.[1]?.headers).toMatchObject(
      expect.objectContaining({ "Idempotency-Key": expect.any(String) }),
    );
  });
});

describe("WaitingListOfferScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replace.mockReset();
    params.current = { offerReference: "wlo_1" };
    document.documentElement.dir = "rtl";
  });

  it("accepts offer into booking confirmation and prevents duplicate submit", async () => {
    const user = userEvent.setup();
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/accept")) {
        return { outcome: "confirmed", bookingReference: "BK21A" };
      }
      return offerPayload();
    });
    renderWithProviders(<WaitingListOfferScreen reference="wlo_1" />);
    const accept = await screen.findByRole("button", { name: "پذیرش پیشنهاد" });
    await user.click(accept);
    await user.click(accept);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/booking/confirmation/BK21A");
    });
    const accepts = mockedClient.mock.calls.filter((call) => String(call[0]).includes("/accept"));
    expect(accepts).toHaveLength(1);
  });

  it("routes payment-required and slot-taken outcomes", async () => {
    const user = userEvent.setup();
    mockedClient
      .mockResolvedValueOnce(offerPayload())
      .mockResolvedValueOnce({ outcome: "payment_required", holdReference: "hold_9" });
    renderWithProviders(<WaitingListOfferScreen reference="wlo_1" />);
    await user.click(await screen.findByRole("button", { name: "پذیرش پیشنهاد" }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/booking/payment");
    });

    replace.mockReset();
    mockedClient.mockReset();
    mockedClient
      .mockResolvedValueOnce(offerPayload())
      .mockResolvedValueOnce({ outcome: "slot_taken", message: "گرفته شد" })
      .mockResolvedValueOnce(offerPayload({ status: "slot_taken", canAccept: false }));
    renderWithProviders(<WaitingListOfferScreen reference="wlo_1" />);
    await user.click(await screen.findByRole("button", { name: "پذیرش پیشنهاد" }));
    await waitFor(() => {
      expect(screen.getAllByText(/گرفته شد|زمان گرفته شد/).length).toBeGreaterThan(0);
    });
  });

  it("explains reject-keeps-entry semantics in the confirm dialog", async () => {
    const user = userEvent.setup();
    mockedClient.mockResolvedValue(offerPayload({ rejectKeepsEntryActive: true }));
    renderWithProviders(<WaitingListOfferScreen reference="wlo_1" />);
    await user.click(await screen.findByRole("button", { name: "رد پیشنهاد" }));
    expect(
      screen.getByText(/فقط همین پیشنهاد رد می‌شود و درخواست لیست انتظار فعال می‌ماند/),
    ).toBeInTheDocument();
  });
});

describe("WaitingListEntryScreen leave", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replace.mockReset();
    params.current = { entryReference: "wle_1" };
  });

  it("requires confirmation before leave and does not optimistically remove", async () => {
    const user = userEvent.setup();
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/leave")) {
        return {};
      }
      return entryPayload();
    });
    renderWithProviders(<WaitingListEntryScreen reference="wle_1" />);
    expect(await screen.findByText("ویزیت عمومی")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ترک لیست انتظار" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mockedClient.mock.calls.some((call) => String(call[0]).includes("/leave"))).toBe(
      false,
    );
    const confirmButtons = screen.getAllByRole("button", { name: "ترک لیست انتظار" });
    await user.click(confirmButtons[confirmButtons.length - 1]!);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/waiting-list");
    });
  });
});

describe("OfferCountdown", () => {
  it("announces only at meaningful thresholds", () => {
    const { rerender } = renderWithProviders(
      <OfferCountdown
        expiresAt="2026-08-22T12:00:00.000Z"
        serverNow="2026-08-22T11:59:50.000Z"
        receivedAt={Date.now()}
      />,
    );
    expect(screen.getByText(/مهلت پیشنهاد رو به پایان است/)).toBeInTheDocument();
    rerender(
      <OfferCountdown
        expiresAt="2026-08-22T12:00:00.000Z"
        serverNow="2026-08-22T11:50:00.000Z"
        receivedAt={Date.now()}
      />,
    );
    // Active urgency has no live announcement text beyond empty polite region.
    expect(screen.queryByText(/مهلت پیشنهاد به‌زودی پایان می‌یابد/)).not.toBeInTheDocument();
  });
});

describe("TimeStep waiting-list CTA", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    vi.spyOn(capabilities, "isCapabilityVisible").mockReturnValue(true);
  });

  it("does not show join CTA for empty slots without Backend flag", async () => {
    mockedClient.mockResolvedValue({ data: { configuration_valid: true, days: [{ date: "2026-08-22", slots: [] }] } });
    renderWithProviders(
      <TimeStep
        serviceId="svc_1"
        branchId="br_1"
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        date="2026-08-22"
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    expect(await screen.findByText("ساعت خالی نیست")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "پیوستن به لیست انتظار" })).not.toBeInTheDocument();
  });

  it("shows join CTA only when Backend sets waitingListJoinAllowed", async () => {
    mockedClient.mockResolvedValue({ data: { configuration_valid: true, days: [{ date: "2026-08-22", slots: [] }], waitingListJoinAllowed: true } });
    renderWithProviders(
      <TimeStep
        serviceId="svc_1"
        branchId="br_1"
        preference={{ type: "specific", providerId: "prv_1" }}
        requiresBranch={false}
        providerMode="optional"
        date="2026-08-22"
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    const link = await screen.findByRole("link", { name: "پیوستن به لیست انتظار" });
    expect(link).toHaveAttribute(
      "href",
      "/waiting-list/join?service=svc_1&branch=br_1&date=2026-08-22&provider=prv_1",
    );
  });
});

describe("waiting-list integration path", () => {
  it("covers empty availability → join → offer → accept → confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(capabilities, "isCapabilityVisible").mockReturnValue(true);
    mockedClient.mockResolvedValue({ data: { configuration_valid: true, days: [{ date: "2026-08-22", slots: [] }], waitingListJoinAllowed: true } });
    renderWithProviders(
      <TimeStep
        serviceId="svc_1"
        branchId="br_1"
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        date="2026-08-22"
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    expect(await screen.findByRole("link", { name: "پیوستن به لیست انتظار" })).toHaveAttribute(
      "href",
      expect.stringContaining("/waiting-list/join?service=svc_1"),
    );

    search.current = new URLSearchParams("service=svc_1&date=2026-08-22");
    mockedClient.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (String(path).includes("catalog") || String(path).includes("/services")) {
        return {
          items: [
            {
              id: "svc_1",
              name: "ویزیت",
              bookingEnabled: true,
              pricing: {},
              availability: "bookable",
            },
          ],
        };
      }
      if (String(path).includes("eligibility")) return { eligible: true };
      if (String(path).includes("providers")) {
        return { items: [], mode: "optional", allowAny: true };
      }
      if (options?.method === "POST" && String(path).endsWith("/customer/waiting-list")) {
        return entryPayload("wle_flow");
      }
      return {};
    });
    replace.mockReset();
    renderWithProviders(<WaitingListJoinScreen />);
    await user.click(await screen.findByRole("button", { name: "ثبت درخواست لیست انتظار" }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/waiting-list/wle_flow");
    });

    params.current = { offerReference: "wlo_flow" };
    replace.mockReset();
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/accept")) {
        return { outcome: "confirmed", bookingReference: "BKFLOW" };
      }
      return offerPayload({ publicReference: "wlo_flow" });
    });
    renderWithProviders(<WaitingListOfferScreen reference="wlo_flow" />);
    await user.click(await screen.findByRole("button", { name: "پذیرش پیشنهاد" }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/booking/confirmation/BKFLOW");
    });
  });
});

describe("waiting-list cache invalidation", () => {
  it("invalidates waiting-list and booking caches after accept", async () => {
    const { invalidateAfterWaitingListAccept } = await import(
      "@/lib/api/customer-waiting-list"
    );
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const removeSpy = vi.spyOn(queryClient, "removeQueries");
    invalidateAfterWaitingListAccept(queryClient, "user_1", {
      outcome: "confirmed",
      bookingReference: "BK21A",
    });
    expect(spy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });
});
