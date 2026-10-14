import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/ui/data-display";
import { parseStatusKey, type StatusKey } from "@/lib/status/status-map";

const KEYS: StatusKey[] = [
  "pending",
  "scheduled",
  "confirmed",
  "rescheduled",
  "checkedIn",
  "inProgress",
  "completed",
  "cancelled",
  "noShow",
  "pendingPayment",
  "processing",
  "paid",
  "depositPaid",
  "payAtLocation",
  "unpaid",
  "failed",
  "expired",
  "refunded",
  "partiallyRefunded",
  "unknown",
];

describe("StatusBadge", () => {
  it("gives every status a distinct visible text label, not only a color", () => {
    const labels = KEYS.map((key) => {
      const { container, unmount } = render(<StatusBadge status={key} />);
      const text = container.textContent?.trim() ?? "";
      expect(text.length).toBeGreaterThan(0);
      expect(container.querySelector(".ds-status__dot")).toHaveAttribute("aria-hidden", "true");
      unmount();
      return text;
    });
    expect(new Set(labels).size).toBe(KEYS.length);
  });

  it("uses tone classes that separate success, danger and warning states", () => {
    const { rerender, container } = render(<StatusBadge status="paid" />);
    expect(container.firstElementChild).toHaveClass("ds-status--success");
    rerender(<StatusBadge status="failed" />);
    expect(container.firstElementChild).toHaveClass("ds-status--danger");
    rerender(<StatusBadge status="pendingPayment" />);
    expect(container.firstElementChild).toHaveClass("ds-status--warning");
  });

  it("maps Backend status spellings onto the same badge", () => {
    expect(parseStatusKey("canceled")).toBe("cancelled");
    expect(parseStatusKey("NO-SHOW")).toBe("noShow");
    expect(parseStatusKey("payment_pending")).toBe("pendingPayment");
    expect(parseStatusKey("checked_in")).toBe("checkedIn");
    expect(parseStatusKey("something_new")).toBeUndefined();
    expect(parseStatusKey(42)).toBeUndefined();
  });

  it("prefers a Backend-provided label and can omit the dot", () => {
    const { container } = render(<StatusBadge status="confirmed" label="تأیید پذیرش" withDot={false} />);
    expect(screen.getByText("تأیید پذیرش")).toBeInTheDocument();
    expect(screen.queryByText("تأییدشده")).not.toBeInTheDocument();
    expect(container.querySelector(".ds-status__dot")).toBeNull();
  });
});
