import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  BackendDependencyState,
  ConflictState,
  EmptyState,
  FeatureDisabledState,
  NoResultsState,
  PermissionDeniedState,
  SessionExpiredState,
} from "@/components/feedback/app-states";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ListQueryState } from "@/components/feedback/query-state";

describe("Phase 44 UX states", () => {
  it("keeps empty and no-results distinct from feature-disabled and backend dependency", () => {
    const { rerender } = render(<EmptyState />);
    expect(screen.getByRole("heading", { name: "موردی برای نمایش نیست" })).toBeInTheDocument();

    rerender(<NoResultsState />);
    expect(screen.getByRole("heading", { name: "نتیجه‌ای پیدا نشد" })).toBeInTheDocument();

    rerender(<FeatureDisabledState />);
    expect(screen.getByRole("heading", { name: "این قابلیت فعال نیست" })).toBeInTheDocument();

    rerender(<BackendDependencyState />);
    expect(screen.getByRole("heading", { name: "اتصال به سرویس آماده نیست" })).toBeInTheDocument();
    expect(screen.getByText(/خالی بودن داده نیست/)).toBeInTheDocument();

    rerender(<PermissionDeniedState />);
    expect(screen.getByText(/از حساب خود خارج نمی‌شوید/)).toBeInTheDocument();

    rerender(<SessionExpiredState />);
    expect(screen.getByRole("heading", { name: "نشست شما پایان یافته است" })).toBeInTheDocument();

    rerender(<ConflictState />);
    expect(screen.getByRole("heading", { name: "وضعیت تغییر کرده است" })).toBeInTheDocument();
  });

  it("ListQueryState prefers loading then error then empty/no-results then content", () => {
    const { rerender } = render(
      <ListQueryState
        isPending
        isEmpty
        skeleton={<div>skeleton</div>}
      >
        <div>content</div>
      </ListQueryState>,
    );
    expect(screen.getByText("skeleton")).toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();

    rerender(
      <ListQueryState
        isPending={false}
        error={{ status: 500, message: "fail" }}
        isEmpty
        skeleton={<div>skeleton</div>}
        onRetry={() => undefined}
      >
        <div>content</div>
      </ListQueryState>,
    );
    expect(screen.getByRole("heading", { name: "اختلال موقت سرویس" })).toBeInTheDocument();

    rerender(
      <ListQueryState
        isPending={false}
        isEmpty
        hasActiveFilters
        skeleton={<div>skeleton</div>}
        onClearFilters={() => undefined}
      >
        <div>content</div>
      </ListQueryState>,
    );
    expect(screen.getByRole("heading", { name: "نتیجه‌ای پیدا نشد" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "پاک کردن فیلترها" })).toBeInTheDocument();

    rerender(
      <ListQueryState isPending={false} isEmpty={false} skeleton={<div>skeleton</div>}>
        <div>content</div>
      </ListQueryState>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("destructive confirm focuses the safe cancel action first", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="لغو نوبت؟"
        description="نوبت مشتری نمونه لغو می‌شود."
        consequence="ممکن است هزینه یا سیاست لغو اعمال شود."
        confirmLabel="لغو نوبت"
        variant="destructive"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText(/هزینه یا سیاست/)).toBeInTheDocument();
    const cancel = screen.getByRole("button", { name: "انصراف" });
    await vi.waitFor(() => {
      expect(cancel).toHaveFocus();
    });
    await user.click(screen.getByRole("button", { name: "لغو نوبت" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
