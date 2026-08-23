import { describe, expect, it } from "vitest";
import { canEnterStep, composeBookingSteps, firstIncompleteStep } from "@/lib/booking/steps";

describe("booking step composition", () => {
  it("starts with only the service step", () => {
    expect(
      composeBookingSteps({
        serviceSelected: false,
        branchesEnabled: true,
        eligibleBranchCount: 4,
        branchesResolved: true,
        providerMode: "required",
        providersResolved: true,
        additionalFieldCount: 2,
        fieldsResolved: true,
      }),
    ).toEqual(["service"]);
  });

  it("skips branch when there is a single valid branch", () => {
    expect(
      composeBookingSteps({
        serviceSelected: true,
        branchesEnabled: true,
        eligibleBranchCount: 1,
        branchesResolved: true,
        providerMode: "not_applicable",
        providersResolved: true,
        additionalFieldCount: 0,
        fieldsResolved: true,
      }),
    ).toEqual(["service", "date", "time", "summary", "checkout"]);
  });

  it("includes branch when multiple branches exist", () => {
    const steps = composeBookingSteps({
      serviceSelected: true,
      branchesEnabled: true,
      eligibleBranchCount: 2,
      branchesResolved: true,
      providerMode: "not_applicable",
      providersResolved: true,
      additionalFieldCount: 0,
      fieldsResolved: true,
    });
    expect(steps).toEqual(["service", "branch", "date", "time", "summary", "checkout"]);
  });

  it("skips provider for automatic and not_applicable modes", () => {
    const automatic = composeBookingSteps({
      serviceSelected: true,
      branchesEnabled: false,
      eligibleBranchCount: 0,
      branchesResolved: true,
      providerMode: "automatic",
      providersResolved: true,
      additionalFieldCount: 0,
      fieldsResolved: true,
    });
    expect(automatic).not.toContain("provider");
    const hidden = composeBookingSteps({
      ...{
        serviceSelected: true,
        branchesEnabled: false,
        eligibleBranchCount: 0,
        branchesResolved: true,
        additionalFieldCount: 0,
        fieldsResolved: true,
      },
      providerMode: "not_applicable",
      providersResolved: true,
    });
    expect(hidden).not.toContain("provider");
  });

  it("includes optional and required provider steps", () => {
    expect(
      composeBookingSteps({
        serviceSelected: true,
        branchesEnabled: false,
        eligibleBranchCount: 0,
        branchesResolved: true,
        providerMode: "optional",
        providersResolved: true,
        additionalFieldCount: 0,
        fieldsResolved: true,
      }),
    ).toContain("provider");
  });

  it("inserts additional information only when fields exist", () => {
    const steps = composeBookingSteps({
      serviceSelected: true,
      branchesEnabled: false,
      eligibleBranchCount: 0,
      branchesResolved: true,
      providerMode: "not_applicable",
      providersResolved: true,
      additionalFieldCount: 1,
      fieldsResolved: true,
    });
    expect(steps).toEqual(["service", "date", "time", "details", "summary", "checkout"]);
  });

  it("rejects direct access to a future required step", () => {
    const steps = ["service", "date", "time", "summary", "checkout"] as const;
    expect(canEnterStep([...steps], "summary", (id) => id === "service")).toBe(false);
    expect(canEnterStep([...steps], "date", (id) => id === "service")).toBe(true);
  });

  it("finds the first incomplete step", () => {
    expect(
      firstIncompleteStep(["service", "date", "time"], (id) => id === "service"),
    ).toBe("date");
  });
});
