import { describe, expect, it } from "vitest";
import { useSubmitting } from "@/lib/ui/use-submitting";
import { renderHook, act } from "@testing-library/react";

describe("useSubmitting", () => {
  it("prevents duplicate concurrent submissions", async () => {
    const { result } = renderHook(() => useSubmitting());
    let active = 0;
    let maxActive = 0;

    const task = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 30));
      active -= 1;
    };

    await act(async () => {
      const first = result.current.run(task);
      const second = result.current.run(task);
      await Promise.all([first, second]);
    });

    expect(maxActive).toBe(1);
    expect(result.current.submitting).toBe(false);
  });
});
