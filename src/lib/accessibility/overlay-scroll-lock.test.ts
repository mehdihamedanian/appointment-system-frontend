import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScrollLock } from "@/lib/accessibility/overlay";

describe("useScrollLock (Phase 43)", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    document.body.style.paddingInlineEnd = "";
  });

  afterEach(() => {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    document.body.style.paddingInlineEnd = "";
  });

  it("locks body and html overflow while active and restores on cleanup", () => {
    document.body.style.overflow = "auto";
    const { rerender, unmount } = renderHook(
      ({ active }: { active: boolean }) => useScrollLock(active),
      { initialProps: { active: true } },
    );

    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");

    rerender({ active: false });
    expect(document.body.style.overflow).toBe("auto");

    rerender({ active: true });
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("compensates scrollbar gutter when present", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1024);
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      get: () => 1008,
    });

    const { unmount } = renderHook(() => useScrollLock(true));
    expect(document.body.style.paddingInlineEnd).toBe("16px");
    unmount();
    expect(document.body.style.paddingInlineEnd).toBe("");
  });
});
