import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateStep } from "@/features/booking/steps/date-step";
import { TimeStep } from "@/features/booking/steps/time-step";
import { SlotPicker } from "@/features/booking/slot-picker";
import { Calendar } from "@/components/ui/calendar";
import { ApiError } from "@/lib/api/errors";
import { renderWithProviders } from "@/test/render";
import { axeViolations } from "@/test/axe";
import { render } from "@testing-library/react";

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

// 09:00 in Asia/Tehran (+03:30).
const SLOT_0900 = { start: "2030-08-22T05:30:00Z", end: "2030-08-22T06:00:00Z" };

function backendSlots(slots: Array<Record<string, unknown>>) {
  return {
    success: true,
    data: {
      timezone: "Asia/Tehran",
      configuration_valid: true,
      days: [{ date: "2030-08-22", slots }],
    },
  };
}

describe("availability calendar", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    document.documentElement.dir = "rtl";
  });

  it("waits for a valid service before requesting dates", async () => {
    renderWithProviders(
      <DateStep
        serviceId={null}
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        selected={null}
        onSelect={() => undefined}
      />,
    );
    await screen.findByRole("grid", { name: "تقویم" });
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it("fetches the visible Jalali month as a Gregorian range and renders backend days", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-20T08:00:00Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    mockedClient.mockResolvedValue({
      success: true,
      data: {
        timezone: "Asia/Tehran",
        configuration_valid: true,
        days: [
          { date: "2026-08-21", slots: [] },
          { date: "2026-08-22", slots: [{ start: "2026-08-22T05:30:00Z", end: "2026-08-22T06:00:00Z" }] },
        ],
      },
    });
    const user = userEvent.setup();
    renderWithProviders(
      <DateStep
        serviceId="svc_1"
        branchId="br_1"
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        selected={null}
        onSelect={() => undefined}
        timezone="Asia/Tehran"
      />,
    );
    // 2026-08-22 is 31 Mordad 1405; Mordad spans 2026-07-23 … 2026-08-22.
    expect(await screen.findByRole("gridcell", { name: /^31 مرداد.*قابل رزرو/ })).toBeEnabled();
    expect(screen.getByRole("gridcell", { name: /^30 مرداد.*غیرفعال/ })).toBeDisabled();
    expect(mockedClient).toHaveBeenCalledWith(
      "/services/svc_1/availability",
      expect.objectContaining({
        query: expect.objectContaining({ from: "2026-07-23", to: "2026-08-22" }),
      }),
    );

    await user.click(screen.getByRole("button", { name: "ماه بعد" }));
    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalledWith(
        "/services/svc_1/availability",
        expect.objectContaining({
          query: expect.objectContaining({ from: "2026-08-23", to: "2026-09-22" }),
        }),
      );
    });
  });

  it("explains that the Backend needs a branch before showing dates", async () => {
    renderWithProviders(
      <DateStep
        serviceId="svc_1"
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        selected={null}
        onSelect={() => undefined}
      />,
    );
    expect(await screen.findByText("شعبه انتخاب نشده است")).toBeInTheDocument();
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it("disables past days and days outside the booking range", () => {
    const onChange = vi.fn();
    render(
      <Calendar
        value="2026-08-22"
        today="2026-08-22"
        min="2026-08-22"
        max="2026-08-25"
        onChange={onChange}
      />,
    );
    // 2026-08-21 = 30 Mordad 1405.
    expect(screen.getByRole("gridcell", { name: /^30 مرداد/ })).toBeDisabled();
    expect(screen.getByRole("gridcell", { name: /^31 مرداد/ })).toBeEnabled();
  });

  it("navigates Jalali months from the calendar heading controls", async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();
    render(
      <Calendar
        value="2026-08-22"
        today="2026-08-22"
        onChange={() => undefined}
        onMonthChange={onMonthChange}
      />,
    );
    expect(screen.getByText("مرداد ۱۴۰۵")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ماه بعد" }));
    expect(screen.getByText("شهریور ۱۴۰۵")).toBeInTheDocument();
    expect(onMonthChange).toHaveBeenCalledWith("j1405-06");
  });

  it("keeps the Gregorian grid available when configured", async () => {
    const user = userEvent.setup();
    render(
      <Calendar calendar="gregorian" value="2026-08-22" today="2026-08-22" onChange={() => undefined} />,
    );
    expect(screen.getByText("اوت 2026")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ماه بعد" }));
    expect(screen.getByText("سپتامبر 2026")).toBeInTheDocument();
  });

  it("starts the Jalali grid on Saturday and emits Gregorian ISO values", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Calendar value="2026-08-22" today="2026-08-01" onChange={onChange} />);
    const cells = screen.getAllByRole("gridcell");
    // 1 Mordad 1405 (2026-07-23) is a Thursday; the Saturday before is 2026-07-18.
    expect(cells[0]).toHaveAttribute("data-date", "2026-07-18");
    expect(cells[0]).toHaveAttribute("data-outside", "true");
    expect(cells.filter((cell) => !cell.hasAttribute("data-outside"))).toHaveLength(31);
    await user.click(screen.getByRole("gridcell", { name: /^1 مرداد/ }));
    expect(onChange).toHaveBeenCalledWith("2026-07-23");
  });

  it("derives today from the business timezone, not the device clock date", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 21:00 UTC on 21 Aug is 00:30 on 22 Aug in Tehran.
    vi.setSystemTime(new Date("2026-08-21T21:00:00Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { unmount } = render(<Calendar timeZone="Asia/Tehran" onChange={() => undefined} />);
    expect(document.querySelector('[aria-current="date"]')).toHaveAttribute("data-date", "2026-08-22");
    unmount();
    render(<Calendar timeZone="UTC" onChange={() => undefined} />);
    expect(document.querySelector('[aria-current="date"]')).toHaveAttribute("data-date", "2026-08-21");
  });

  it("exposes a single tab stop and moves focus with RTL-aware arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <div dir="rtl">
        <Calendar value="2026-08-12" today="2026-08-12" onChange={onChange} />
      </div>,
    );
    const tabbable = screen.getAllByRole("gridcell").filter((cell) => cell.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAttribute("data-date", "2026-08-12");
    tabbable[0]!.focus();
    // RTL: ArrowLeft is the next day, ArrowDown the next week.
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toHaveAttribute("data-date", "2026-08-13");
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toHaveAttribute("data-date", "2026-08-20");
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toHaveAttribute("data-date", "2026-08-19");
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith("2026-08-19");
  });

  it("skips unavailable days and crosses months with the keyboard", async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();
    render(
      <div dir="rtl">
        <Calendar
          value="2026-08-20"
          today="2026-08-01"
          isDateDisabled={(iso) => iso === "2026-08-21"}
          onChange={() => undefined}
          onMonthChange={onMonthChange}
        />
      </div>,
    );
    screen.getByRole("gridcell", { name: /^29 مرداد/ }).focus();
    // 30 Mordad (2026-08-21) is unavailable and skipped.
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toHaveAttribute("data-date", "2026-08-22");
    // Next day is 1 Shahrivar: the month changes and focus follows.
    await user.keyboard("{ArrowLeft}");
    expect(onMonthChange).toHaveBeenCalledWith("j1405-06");
    expect(screen.getByText("شهریور ۱۴۰۵")).toBeInTheDocument();
    expect(document.activeElement).toHaveAttribute("data-date", "2026-08-23");
    await user.keyboard("{PageUp}");
    expect(screen.getByText("مرداد ۱۴۰۵")).toBeInTheDocument();
    expect(document.activeElement).toHaveAttribute("data-date", "2026-07-23");
  });
});

describe("slot picker", () => {
  it("selects a backend slot id and groups morning and afternoon", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <SlotPicker
        slots={[
          { id: "slot_am", label: "09:00", startsAt: "", status: "available" },
          { id: "slot_pm", label: "14:00", startsAt: "", status: "available" },
          { id: "slot_held", label: "15:00", startsAt: "", status: "held" },
        ]}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText("صبح")).toBeInTheDocument();
    expect(screen.getByText("بعدازظهر")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /09:00/ }));
    expect(onSelect).toHaveBeenCalledWith("slot_am");
    expect(screen.getByRole("radio", { name: /15:00/ })).toBeDisabled();
  });

  it("selects a slot with the keyboard and has no axe violations", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <SlotPicker
        slots={[
          { id: "slot_am", label: "09:00", startsAt: "", status: "available" },
          { id: "slot_held", label: "15:00", startsAt: "", status: "held" },
        ]}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    await user.tab();
    expect(screen.getByRole("radio", { name: /09:00/ })).toHaveFocus();
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledWith("slot_am");
    expect(await axeViolations()).toEqual([]);
  });
});

describe("time step availability", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    document.documentElement.dir = "rtl";
  });

  it("does not fetch slots until a date is selected", async () => {
    renderWithProviders(
      <TimeStep
        serviceId="svc_1"
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        date={null}
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it("shows a non-error empty state when no slots exist", async () => {
    mockedClient.mockResolvedValue(backendSlots([]));
    renderWithProviders(
      <TimeStep
        serviceId="svc_1"
        branchId="br_1"
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        date="2030-08-22"
        selectedId={null}
        onSelect={() => undefined}
        onPickAnotherDate={() => undefined}
      />,
    );
    expect(await screen.findByText("ساعت خالی نیست")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "به‌روزرسانی" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "انتخاب تاریخ دیگر" })).toBeInTheDocument();
    expect(screen.queryByText("ساعت‌های قابل رزرو دریافت نشد")).not.toBeInTheDocument();
  });

  it("keeps API errors distinct from no availability", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 500, message: "down", requestId: "req_slot" }));
    renderWithProviders(
      <TimeStep
        serviceId="svc_1"
        branchId="br_1"
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        date="2030-08-22"
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    expect(await screen.findByText("ساعت‌های قابل رزرو دریافت نشد")).toBeInTheDocument();
    expect(screen.getByText(/req_slot/)).toBeInTheDocument();
    expect(screen.queryByText("ساعت خالی نیست")).not.toBeInTheDocument();
  });

  it("clears a selected slot that disappears after refresh", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    mockedClient.mockResolvedValueOnce(backendSlots([SLOT_0900]));
    renderWithProviders(
      <TimeStep
        serviceId="svc_1"
        branchId="br_1"
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        date="2030-08-22"
        selectedId={`slot_${Date.parse(SLOT_0900.start)}`}
        onSelect={onSelect}
      />,
    );
    expect(await screen.findByRole("radio", { name: /0?9:00|۰?۹:۰۰/ })).toBeInTheDocument();
    mockedClient.mockResolvedValueOnce(backendSlots([]));
    await user.click(screen.getByRole("button", { name: "به‌روزرسانی" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("locks slots whose start passed while the list was open and clears that selection", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 09:30 Tehran: the 09:00 slot has started, the 10:00 slot has not.
    vi.setSystemTime(new Date("2030-08-22T06:00:00Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const pastSlot = SLOT_0900;
    const futureSlot = { start: "2030-08-22T06:30:00Z", end: "2030-08-22T07:00:00Z" };
    mockedClient.mockResolvedValue(backendSlots([pastSlot, futureSlot]));
    const onSelect = vi.fn();
    renderWithProviders(
      <TimeStep
        serviceId="svc_1"
        branchId="br_1"
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        date="2030-08-22"
        selectedId={`slot_${Date.parse(pastSlot.start)}`}
        onSelect={onSelect}
      />,
    );
    const past = await screen.findByRole("radio", { name: /(0?9:00|۰?۹:۰۰).*زمان آن گذشته است/ });
    expect(past).toBeDisabled();
    expect(screen.getByRole("radio", { name: /10:00|۱۰:۰۰/ })).toBeEnabled();
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(null);
    });
  });

  it("shows the selected date in the configured calendar", async () => {
    mockedClient.mockResolvedValue(backendSlots([SLOT_0900]));
    renderWithProviders(
      <TimeStep
        serviceId="svc_1"
        branchId="br_1"
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        date="2030-08-22"
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    const label = await screen.findByText((_, element) => element?.tagName === "TIME");
    expect(label).toHaveAttribute("dateTime", "2030-08-22");
    expect(label.textContent).toMatch(/مرداد/);
  });

  it("does not render internal resource names from a slot payload", async () => {
    mockedClient.mockResolvedValue(
      backendSlots([{ ...SLOT_0900, resource: { kind: "room", name: "اتاق ۱" } }]),
    );
    renderWithProviders(
      <TimeStep
        serviceId="svc_1"
        branchId="br_1"
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        date="2030-08-22"
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    expect(await screen.findByRole("radio", { name: /0?9:00|۰?۹:۰۰/ })).toBeInTheDocument();
    expect(screen.queryByText(/اتاق/)).not.toBeInTheDocument();
  });
});
