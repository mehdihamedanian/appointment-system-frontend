import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    const action = screen.getByRole("button", { name: "اقدام" });

    expect(dialog).toBeInTheDocument();
    expect(document.body.contains(dialog)).toBe(true);
    expect(
      focusSpy.mock.instances.some(
        (element) => element === dialog || element === action,
      ),
    ).toBe(true);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    focusSpy.mockRestore();
  });
});
