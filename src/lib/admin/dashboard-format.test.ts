import { describe, expect, it } from "vitest";
import {
  formatCountMetricValue,
  formatMoneyMetricValue,
  METRIC_UNAVAILABLE_LABEL,
} from "@/lib/admin/dashboard-format";

describe("dashboard metric formatting", () => {
  it("formats valid zero differently from unavailable", () => {
    expect(formatCountMetricValue({ state: "ready", value: 0 }).value).toBe("۰");
    expect(formatCountMetricValue({ state: "unavailable" }).value).toBe(
      METRIC_UNAVAILABLE_LABEL,
    );
  });

  it("uses backend revenue label without client calculation", () => {
    expect(
      formatMoneyMetricValue({
        state: "ready",
        amountLabel: "۲۵۰٬۰۰۰ تومان",
      }).value,
    ).toBe("۲۵۰٬۰۰۰ تومان");
  });
});
