import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, toast } from "@/components/feedback/toast";

describe("toast announcements", () => {
  it("exposes success and error messages to assistive technology", async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <button type="button" onClick={() => toast.success("عملیات موفق بود")}>
          موفقیت
        </button>
        <button type="button" onClick={() => toast.error("عملیات ناموفق بود")}>
          خطا
        </button>
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "موفقیت" }));
    expect(screen.getByRole("status")).toHaveTextContent("عملیات موفق بود");

    await user.click(screen.getByRole("button", { name: "خطا" }));
    expect(screen.getByRole("alert")).toHaveTextContent("عملیات ناموفق بود");
  });
});
