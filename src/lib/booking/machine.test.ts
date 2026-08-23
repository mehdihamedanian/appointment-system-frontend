import { describe, expect, it } from "vitest";
import { canTransition, reduceWizardStatus } from "@/lib/booking/machine";

describe("wizard status machine", () => {
  it("prevents double submit from ready after submit-start", () => {
    const submitting = reduceWizardStatus("ready", "submit-start");
    expect(submitting).toBe("submitting");
    expect(canTransition("submitting", "submit-start")).toBe(false);
    expect(reduceWizardStatus("submitting", "submit-start")).toBe("submitting");
  });

  it("moves to success only from submitting", () => {
    expect(reduceWizardStatus("ready", "submit-ok")).toBe("ready");
    expect(reduceWizardStatus("submitting", "submit-ok")).toBe("success");
  });

  it("can expire from an in-progress booking", () => {
    expect(reduceWizardStatus("ready", "expire")).toBe("expired");
  });
});
