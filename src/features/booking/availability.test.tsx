import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateStep } from "@/features/booking/steps/date-step";
import { TimeStep } from "@/features/booking/steps/time-step";
import { SlotPicker } from "@/features/booking/slot-picker";
import { Calendar } from "@/components/ui/calendar";
import { ApiError } from "@/lib/api/errors";
import { renderWithProviders } from "@/test/render";
import { render } from "@testing-library/react";

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

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

  it("renders available and unavailable days from the backend month payload", async () => {
    mockedClient.mockResolvedValue({
      timezone: "Asia/Tehran",
      serverNow: "2026-08-22T08:00:00+03:30",
      minDate: "2026-08-22",
      maxDate: "2026-09-30",
      days: [
        { date: "2026-08-22", status: "available" },
        { date: "2026-08-23", status: "closed" },
      ],
    });
    const onSelect = vi.fn();
    renderWithProviders(
      <DateStep
        serviceId="svc_1"
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        selected={null}
        onSelect={onSelect}
        timezone="Asia/Tehran"
      />,
    );
    expect(await screen.findByRole("gridcell", { name: /قابل رزرو/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /تعطیل/ })).toBeDisabled();
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
    const past = screen.getByRole("gridcell", { name: /21/ });
    expect(past).toBeDisabled();
  });

  it("navigates months from the calendar heading controls", async () => {
    const user = userEvent.setup();
    render(<Calendar value="2026-08-22" today="2026-08-22" onChange={() => undefined} />);
    expect(screen.getByText(/اوت 2026|اوت/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ماه بعد" }));
    expect(screen.getByText(/سپتامبر/)).toBeInTheDocument();
  });

  it("moves selection with arrow keys and respects the calendar grid", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <div dir="rtl">
        <Calendar value="2026-08-22" today="2026-08-22" onChange={onChange} />
      </div>,
    );
    screen.getByRole("grid", { name: "تقویم" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenCalled();
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
    mockedClient.mockResolvedValue({ slots: [] });
    renderWithProviders(
      <TimeStep
        serviceId="svc_1"
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        date="2026-08-22"
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
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        date="2026-08-22"
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
    mockedClient.mockResolvedValueOnce({
      slots: [{ id: "slot_1", startLabel: "09:00" }],
    });
    renderWithProviders(
      <TimeStep
        serviceId="svc_1"
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        date="2026-08-22"
        selectedId="slot_1"
        onSelect={onSelect}
      />,
    );
    expect(await screen.findByRole("radio", { name: /09:00/ })).toBeInTheDocument();
    mockedClient.mockResolvedValueOnce({ slots: [] });
    await user.click(screen.getByRole("button", { name: "به‌روزرسانی" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("does not render internal resource names from a slot payload", async () => {
    mockedClient.mockResolvedValue({
      slots: [
        { id: "slot_1", startLabel: "09:00" },
        { id: "room_1", kind: "room", startLabel: "اتاق ۱" },
      ],
    });
    renderWithProviders(
      <TimeStep
        serviceId="svc_1"
        preference={{ type: "not_applicable" }}
        requiresBranch={false}
        providerMode="not_applicable"
        date="2026-08-22"
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    expect(await screen.findByRole("radio", { name: /09:00/ })).toBeInTheDocument();
    expect(screen.queryByText(/اتاق/)).not.toBeInTheDocument();
  });
});
