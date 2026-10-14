import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminResourceAllocationStep } from "@/features/admin/manual-booking/admin-resource-allocation-step";
import { axeViolations } from "@/test/axe";
import type { AdminResourceAllocationView } from "@/types/admin-manual-booking";

const selectable: AdminResourceAllocationView = {
  mode: "select",
  canOverride: false,
  automaticSummary: "اتاق ۱ به‌صورت خودکار",
  groups: [
    {
      id: "grp_room",
      label: "اتاق درمان",
      mode: "select",
      items: [
        { id: "res_1", name: "اتاق ۱", kind: "room", required: true },
        { id: "res_2", name: "اتاق ۲", kind: "room", required: false },
      ],
    },
  ],
};

function renderStep(props: Partial<Parameters<typeof AdminResourceAllocationStep>[0]> = {}) {
  const onModeChange = vi.fn();
  const onSelectionChange = vi.fn();
  render(
    <AdminResourceAllocationStep
      allocation={selectable}
      mode="select"
      selections={{}}
      canViewResources
      onModeChange={onModeChange}
      onSelectionChange={onSelectionChange}
      {...props}
    />,
  );
  return { onModeChange, onSelectionChange };
}

describe("resource selector (manual booking allocation step)", () => {
  it("offers only Backend-returned resources and reports additions and removals", async () => {
    const user = userEvent.setup();
    const { onSelectionChange } = renderStep({ selections: { grp_room: ["res_2"] } });

    expect(screen.getByRole("group", { name: "اتاق درمان" })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByRole("checkbox", { name: /اتاق ۱.*الزامی/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /اتاق ۲/ })).not.toHaveAccessibleName(/الزامی/);
    expect(screen.getByRole("checkbox", { name: /اتاق ۲/ })).toBeChecked();

    await user.click(screen.getByRole("checkbox", { name: /اتاق ۱/ }));
    expect(onSelectionChange).toHaveBeenLastCalledWith("grp_room", ["res_2", "res_1"]);

    await user.click(screen.getByRole("checkbox", { name: /اتاق ۲/ }));
    expect(onSelectionChange).toHaveBeenLastCalledWith("grp_room", []);
  });

  it("offers one choice per requirement when the Backend accepts a single resource", async () => {
    const user = userEvent.setup();
    const single = { ...selectable, groups: [{ ...selectable.groups[0]!, single: true }] };
    const { onSelectionChange } = renderStep({ allocation: single, selections: { grp_room: ["res_1"] } });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "اتاق ۱" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "اتاق ۲" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith("grp_room", ["res_2"]);
  });

  it("flags a missing manual selection only after submit", () => {
    renderStep({ submitted: true });
    expect(screen.getByRole("alert")).toHaveTextContent("لطفاً منابع لازم را انتخاب کنید.");
  });

  it("hides the resource list in automatic mode and shows the Backend summary", async () => {
    const user = userEvent.setup();
    const { onModeChange } = renderStep({ mode: "automatic" });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("اتاق ۱ به‌صورت خودکار");

    await user.click(screen.getByRole("radio", { name: /^انتخاب از منابع معتبر/ }));
    expect(onModeChange).toHaveBeenCalledWith("select");
  });

  it("offers manual override only when the Backend allows it", () => {
    renderStep();
    expect(screen.queryByRole("radio", { name: /^تغییر دستی/ })).not.toBeInTheDocument();
  });

  it("shows the override choice when the Backend allows it", () => {
    renderStep({ allocation: { ...selectable, canOverride: true } });
    expect(screen.getByRole("radio", { name: /^تغییر دستی/ })).toBeInTheDocument();
  });

  it("never lists resource names to staff without resource permission", () => {
    renderStep({ canViewResources: false });
    expect(screen.getByText("منابع به‌صورت خودکار توسط سرویس تخصیص داده می‌شود.")).toBeInTheDocument();
    expect(screen.queryByText(/اتاق ۱|اتاق ۲/)).not.toBeInTheDocument();
  });

  it("keeps a missing allocation endpoint distinct from a failed request", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { unmount } = render(
      <AdminResourceAllocationStep
        allocation={{ mode: "automatic", groups: [], canOverride: false, unavailableReason: "missing_endpoint" }}
        mode="automatic"
        selections={{}}
        canViewResources
        onModeChange={() => undefined}
        onSelectionChange={() => undefined}
      />,
    );
    expect(screen.getByText("تخصیص منابع هنوز متصل نشده")).toBeInTheDocument();
    unmount();

    render(
      <AdminResourceAllocationStep
        error={{ message: "خطای سرویس" }}
        onRetry={onRetry}
        mode="automatic"
        selections={{}}
        canViewResources
        onModeChange={() => undefined}
        onSelectionChange={() => undefined}
      />,
    );
    expect(screen.getByText("تخصیص منابع دریافت نشد")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /تلاش دوباره|تلاش مجدد/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("has no axe violations with a selectable group", async () => {
    renderStep({ selections: { grp_room: ["res_1"] } });
    expect(await axeViolations()).toEqual([]);
  });
});
