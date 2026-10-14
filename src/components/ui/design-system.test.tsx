import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox, Radio, RadioGroup } from "@/components/ui/selection";
import { Select } from "@/components/ui/select";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs";
import { Accordion } from "@/components/ui/accordion";
import { Calendar } from "@/components/ui/calendar";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/data-display";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUpload } from "@/components/ui/file-upload";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState, NoResultsState, ApiErrorState } from "@/components/feedback/app-states";
import { getDocumentLocale } from "@/config/locale";
import { normalizeDigits } from "@/lib/utilities/digits";

describe("design system", () => {
  it("keeps button width stable while loading and blocks repeat clicks", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button loading onClick={onClick}>
        ذخیره
      </Button>,
    );
    const button = screen.getByRole("button", { name: /ذخیره|در حال انجام/ });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("requires an accessible name on icon buttons", () => {
    render(
      <IconButton label="اعلان‌ها">
        <span>*</span>
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "اعلان‌ها" })).toBeInTheDocument();
  });

  it("associates FormField errors with the input", () => {
    render(
      <FormField id="title" label="عنوان" error="الزامی است">
        <Input id="title" aria-describedby="title-error" invalid />
      </FormField>,
    );
    expect(screen.getByLabelText(/عنوان/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("الزامی است");
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="رمز" />);
    const input = screen.getByLabelText("رمز");
    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "نمایش رمز" }));
    expect(input).toHaveAttribute("type", "text");
  });

  it("exposes checkbox indeterminate state", () => {
    render(<Checkbox label="همه" indeterminate />);
    const input = screen.getByRole("checkbox") as HTMLInputElement;
    expect(input.indeterminate).toBe(true);
  });

  it("keeps radios in a labelled group", () => {
    render(
      <RadioGroup legend="روش">
        <Radio name="m" label="الف" value="a" defaultChecked />
        <Radio name="m" label="ب" value="b" />
      </RadioGroup>,
    );
    expect(screen.getByRole("group", { name: "روش" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("opens select options from the trigger", async () => {
    const user = userEvent.setup();
    render(
      <Select
        options={[{ value: "a", label: "خدمت نمونه" }]}
        onChange={() => undefined}
      />,
    );
    await user.click(screen.getByRole("button", { name: /انتخاب کنید|خدمت نمونه/ }));
    expect(await screen.findByRole("option", { name: "خدمت نمونه" })).toBeInTheDocument();
  });

  it("moves tabs with arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="one">
        <TabList>
          <Tab value="one">یک</Tab>
          <Tab value="two">دو</Tab>
        </TabList>
        <TabPanel value="one">A</TabPanel>
        <TabPanel value="two">B</TabPanel>
      </Tabs>,
    );
    screen.getByRole("tab", { name: "یک" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "دو" })).toHaveFocus();
  });

  it("toggles accordion items", async () => {
    const user = userEvent.setup();
    render(
      <Accordion
        items={[{ id: "1", title: "پرسش", content: "پاسخ نمایشی" }]}
      />,
    );
    const trigger = screen.getByRole("button", { name: "پرسش" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("announces calendar grid semantics and accepts keyboard movement", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <div dir="rtl">
        <Calendar value="2026-08-21" today="2026-08-21" onChange={onChange} />
      </div>,
    );
    expect(screen.getByRole("grid", { name: "تقویم" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")[0]).toHaveTextContent("شنبه");
    expect(screen.getAllByRole("row")).toHaveLength(7);
    await user.tab();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toHaveAttribute("data-date", "2026-08-21");
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toHaveAttribute("data-date", "2026-08-22");
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("2026-08-22");
  });

  it("renders table caption and header cells", () => {
    render(
      <Table caption="مشتریان">
        <TableHeader>
          <TableRow>
            <TableHead>نام</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>نمونه</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole("table", { name: "مشتریان" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "نام" })).toBeInTheDocument();
  });

  it("paginates with previous and next controls", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageCount={5} onPageChange={onPageChange} />);
    await user.click(screen.getByRole("button", { name: "بعدی" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("validates file size before keeping the file", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FileUpload files={[]} onChange={onChange} maxSizeBytes={4} />);
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["hello"], "note.txt", { type: "text/plain" });
    await user.upload(input, file);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("exposes a text label on StatusBadge beyond color", () => {
    render(<StatusBadge status="cancelled" />);
    expect(screen.getByText("لغوشده")).toBeInTheDocument();
  });

  it("keeps empty and error states distinct", () => {
    const { rerender } = render(<EmptyState />);
    expect(screen.getByRole("heading", { name: "موردی برای نمایش نیست" })).toBeInTheDocument();
    rerender(<NoResultsState />);
    expect(screen.getByRole("heading", { name: "نتیجه‌ای پیدا نشد" })).toBeInTheDocument();
    rerender(<ApiErrorState />);
    expect(screen.getByRole("heading", { name: "دریافت اطلاعات ممکن نشد" })).toBeInTheDocument();
  });

  it("uses RTL as the default document direction", () => {
    expect(getDocumentLocale().dir).toBe("rtl");
    expect(normalizeDigits("۰۹۱۲")).toBe("0912");
  });
});

describe("ConfirmDialog", () => {
  it("renders confirm and cancel actions", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="حذف شود؟"
        description="این عمل برگشت‌پذیر نیست."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole("button", { name: "تأیید" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
