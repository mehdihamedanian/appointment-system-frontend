import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Modal } from "@/components/feedback/modal";

describe("modal accessibility", () => {
  it("portals the dialog, focuses it, and closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");

    render(
      <>
        <button type="button">بازکننده</button>
        <Modal open title="عنوان مودال" description="توضیح" onClose={onClose}>
          <button type="button">اقدام</button>
        </Modal>
      </>,
    );

    const dialog = await screen.findByRole("dialog", { name: "عنوان مودال" });
    expect(dialog).toBeInTheDocument();
    expect(document.body.contains(dialog)).toBe(true);
    expect(
      focusSpy.mock.instances.some((element) => dialog.contains(element as Node)),
    ).toBe(true);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    focusSpy.mockRestore();
  });

  it("keeps focus in a field while the parent re-renders with a new onClose", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      const [reason, setReason] = useState("");
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            بازکننده
          </button>
          <Modal open={open} title="لغو نوبت" onClose={() => setOpen(false)}>
            <label htmlFor="reason">دلیل</label>
            <input id="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </Modal>
        </>
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "بازکننده" }));
    const field = await screen.findByLabelText("دلیل");
    await user.click(field);
    await user.keyboard("سلام");
    expect(field).toHaveValue("سلام");
    expect(field).toHaveFocus();
  });

  it("traps Tab inside the dialog and restores focus to the trigger on close", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            بازکننده
          </button>
          <Modal open={open} title="عنوان" onClose={() => setOpen(false)}>
            <button type="button">اقدام</button>
          </Modal>
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "بازکننده" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "عنوان" });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    for (let i = 0; i < 4; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("pulls focus back into the dialog when it escapes", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">بیرون</button>
        <Modal open title="عنوان" onClose={() => undefined}>
          <button type="button">اقدام</button>
        </Modal>
      </>,
    );
    const dialog = await screen.findByRole("dialog", { name: "عنوان" });
    screen.getByRole("button", { name: "بیرون" }).focus();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
