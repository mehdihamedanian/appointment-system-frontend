import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Button } from "@/components/ui/button";
import { DatePicker, TimePicker } from "@/components/ui/date-time";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Select } from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";
import { axeViolations } from "@/test/axe";

const OPTIONS = [
  { value: "a", label: "شعبه مرکزی" },
  { value: "b", label: "شعبه غرب" },
  { value: "c", label: "شعبه شرق" },
];

function ControlledSelect({ onChange }: { onChange: (value: string | undefined) => void }) {
  const [value, setValue] = useState<string | undefined>("a");
  return (
    <Select
      label="شعبه"
      value={value}
      options={OPTIONS}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("Select keyboard support", () => {
  it("moves focus into the listbox, navigates with arrows and restores focus on select", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledSelect onChange={onChange} />);

    await user.tab();
    const trigger = screen.getByRole("button", { name: "شعبه مرکزی" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("{Enter}");
    const listbox = await screen.findByRole("listbox", { name: "شعبه" });
    expect(listbox).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(screen.getByRole("option", { name: "شعبه مرکزی" })).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "شعبه غرب" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("option", { name: "شعبه شرق" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("c");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "شعبه شرق" })).toHaveFocus());
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<ControlledSelect onChange={vi.fn()} />);

    await user.tab();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("option", { name: "شعبه مرکزی" })).toHaveFocus());
    expect(await axeViolations()).toEqual([]);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "شعبه مرکزی" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

describe("Dropdown menu keyboard support", () => {
  it("focuses the first item and wraps arrow navigation", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <Dropdown trigger={<Button variant="secondary">عملیات</Button>}>
        <DropdownItem onSelect={onEdit}>ویرایش</DropdownItem>
        <DropdownItem>کپی</DropdownItem>
        <DropdownItem destructive>حذف</DropdownItem>
      </Dropdown>,
    );

    const trigger = screen.getByRole("button", { name: "عملیات" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await user.tab();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "ویرایش" })).toHaveFocus());

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "حذف" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "ویرایش" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onEdit).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe("DatePicker keyboard support", () => {
  // The calendar is portalled to <body>; the app sets `dir` on <html>.
  beforeEach(() => {
    document.documentElement.dir = "rtl";
  });
  afterEach(() => {
    document.documentElement.removeAttribute("dir");
  });

  it("opens from the keyboard, focuses the selected day and picks with RTL arrows", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <div dir="rtl">
        <label htmlFor="visit-date">تاریخ مراجعه</label>
        <DatePicker
          id="visit-date"
          value="2026-08-21"
          onChange={onChange}
          timeZone="Asia/Tehran"
        />
      </div>,
    );

    await user.tab();
    const input = screen.getByRole("combobox", { name: "تاریخ مراجعه" });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-haspopup", "dialog");

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "انتخاب تاریخ" })).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "true");
    await waitFor(() =>
      expect(document.activeElement).toHaveAttribute("data-date", "2026-08-21"),
    );
    expect(await axeViolations()).toEqual([]);

    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toHaveAttribute("data-date", "2026-08-22");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("2026-08-22");
  });

  it("closes on Escape and returns focus to the input", async () => {
    const user = userEvent.setup();
    render(
      <div dir="rtl">
        <label htmlFor="visit-date">تاریخ مراجعه</label>
        <DatePicker id="visit-date" value="2026-08-21" onChange={vi.fn()} />
      </div>,
    );

    await user.tab();
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("dialog", { name: "انتخاب تاریخ" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "تاریخ مراجعه" })).toHaveFocus();
  });
});

describe("TimePicker keyboard support", () => {
  it("focuses the selected time and moves through options with arrows", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimePicker value="09:00" min="08:00" max="12:00" onChange={onChange} />);

    await user.tab();
    const trigger = screen.getByRole("button", { name: "09:00" });
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    await user.keyboard("{Enter}");
    await screen.findByRole("listbox", { name: "انتخاب ساعت" });
    await waitFor(() => expect(screen.getByRole("option", { name: "09:00" })).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "09:30" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("09:30");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("Tabs semantics", () => {
  it("links tabs to mounted panels only", async () => {
    render(
      <>
        <Tabs defaultValue="upcoming">
          <TabList>
            <Tab value="upcoming">آینده</Tab>
            <Tab value="past">گذشته</Tab>
          </TabList>
          <TabPanel value="upcoming">نوبت‌های آینده</TabPanel>
          <TabPanel value="past">نوبت‌های گذشته</TabPanel>
        </Tabs>
        <Tabs defaultValue="all">
          <TabList>
            <Tab value="all">همه</Tab>
            <Tab value="unread">خوانده‌نشده</Tab>
          </TabList>
        </Tabs>
      </>,
    );

    const upcoming = screen.getByRole("tab", { name: "آینده" });
    const panel = screen.getByRole("tabpanel", { name: "آینده" });
    await waitFor(() => expect(upcoming).toHaveAttribute("aria-controls", panel.id));
    expect(panel).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "گذشته" })).not.toHaveAttribute("aria-controls");
    expect(screen.getByRole("tab", { name: "همه" })).not.toHaveAttribute("aria-controls");
    expect(await axeViolations()).toEqual([]);
  });
});

describe("Stepper semantics", () => {
  it("announces step states and the current position", async () => {
    render(
      <Stepper
        steps={[
          { id: "service", label: "خدمت", state: "complete" },
          { id: "time", label: "زمان", state: "current" },
          { id: "confirm", label: "تأیید", state: "upcoming" },
        ]}
      />,
    );

    expect(screen.getByRole("list", { name: "مراحل" })).toBeInTheDocument();
    expect(screen.getByText("، تکمیل‌شده")).toHaveClass("visually-hidden");
    expect(screen.getByText("زمان").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("مرحله 2 از 3: زمان")).toHaveClass("visually-hidden");
    expect(await axeViolations()).toEqual([]);
  });
});

describe("ConfirmDialog accessibility", () => {
  it("describes the consequence, focuses the safe action and has no axe violations", async () => {
    render(
      <ConfirmDialog
        open
        title="لغو نوبت"
        description="این نوبت لغو می‌شود."
        consequence="مبلغ بیعانه بازگردانده نمی‌شود."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "لغو نوبت" });
    expect(dialog).toHaveAccessibleDescription(/این نوبت لغو می‌شود.*مبلغ بیعانه بازگردانده نمی‌شود/);
    await waitFor(() => expect(screen.getByRole("button", { name: "انصراف" })).toHaveFocus());
    expect(await axeViolations()).toEqual([]);
  });
});
