import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ApiErrorState,
  EmptyState,
  NoResultsState,
} from "@/components/feedback/app-states";

describe("shared UX states", () => {
  it("keeps empty and no-results copy distinct", () => {
    const { rerender } = render(<EmptyState />);
    expect(screen.getByRole("heading", { name: "موردی برای نمایش نیست" })).toBeInTheDocument();
    expect(
      screen.getByText("وقتی داده‌ای ثبت شود، اینجا نمایش داده می‌شود."),
    ).toBeInTheDocument();

    rerender(<NoResultsState />);
    expect(screen.getByRole("heading", { name: "نتیجه‌ای پیدا نشد" })).toBeInTheDocument();
    expect(screen.getByText("عبارت یا فیلتر دیگری را امتحان کنید.")).toBeInTheDocument();
  });

  it("renders an API error with a retry action", async () => {
    const onRetry = vi.fn();
    render(<ApiErrorState onRetry={onRetry} />);

    expect(screen.getByRole("heading", { name: "دریافت اطلاعات ممکن نشد" })).toBeInTheDocument();
    screen.getByRole("button", { name: "تلاش دوباره" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
