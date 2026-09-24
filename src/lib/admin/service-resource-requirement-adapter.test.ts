import { describe, expect, it } from "vitest";
import {
  adaptAdminServiceResourceRequirements,
  buildRequirementSummaryLine,
  buildSummaryLineFromDraft,
  detectDuplicateTypeWarnings,
  draftsFromView,
  sanitizeRequirementsPayload,
  validateRequirementDraft,
  requirementInvolvesInternalResources,
} from "@/lib/admin/service-resource-requirement-adapter";
import type { AdminServiceResourceRequirementItem } from "@/types/admin-service-resource-requirement";

describe("service resource requirement adapter", () => {
  it("builds summary for any_of_type requirement", () => {
    const line = buildRequirementSummaryLine({
      key: "r1",
      resourceType: "staff",
      resourceTypeLabel: "کارمند",
      quantity: 1,
      necessity: "required",
      selectionMode: "any_of_type",
      specificSemantics: "unknown",
      selectedResources: [],
      branchScope: "global",
      staffRole: "تکنسین",
    });
    expect(line).toContain("الزامی");
    expect(line).toContain("کارمند");
    expect(line).toContain("تکنسین");
  });

  it("builds summary for specific resources with semantics from backend", () => {
    const line = buildRequirementSummaryLine({
      key: "r2",
      resourceType: "device",
      resourceTypeLabel: "دستگاه",
      quantity: 1,
      necessity: "required",
      selectionMode: "specific",
      specificSemantics: "any_one",
      selectedResources: [
        { id: "d1", name: "MRI A", type: "device", active: true },
        { id: "d2", name: "MRI B", type: "device", active: true },
      ],
      branchScope: "global",
    });
    expect(line).toContain("MRI A");
    expect(line).toContain("جایگزین");
  });

  it("warns on duplicate types without blocking save", () => {
    const items: AdminServiceResourceRequirementItem[] = [
      {
        key: "a",
        resourceType: "room",
        resourceTypeLabel: "اتاق",
        quantity: 1,
        necessity: "required",
        selectionMode: "any_of_type",
        specificSemantics: "unknown",
        selectedResources: [],
        branchScope: "global",
      },
      {
        key: "b",
        resourceType: "room",
        resourceTypeLabel: "اتاق",
        quantity: 1,
        necessity: "optional",
        selectionMode: "any_of_type",
        specificSemantics: "unknown",
        selectedResources: [],
        branchScope: "global",
      },
    ];
    expect(detectDuplicateTypeWarnings(items).length).toBeGreaterThan(0);
  });

  it("validates specific mode requires selection", () => {
    const errors = validateRequirementDraft(
      {
        key: "x",
        resourceType: "room",
        quantity: 1,
        necessity: "required",
        selectionMode: "specific",
        selectedResourceIds: [],
        branchScope: "global",
      },
      {},
    );
    expect(errors.selectedResourceIds).toBeTruthy();
  });

  it("sanitizes payload without customer-visible internal fields", () => {
    const payload = sanitizeRequirementsPayload({
      requirements: [
        {
          key: "1",
          resourceType: "room",
          quantity: 1,
          necessity: "required",
          selectionMode: "any_of_type",
          selectedResourceIds: [],
          branchScope: "global",
        },
      ],
    });
    expect(payload.requirements).toHaveLength(1);
    expect(JSON.stringify(payload)).not.toContain("customerVisible");
  });

  it("marks internal staff requirement when not provider selectable", () => {
    const internal: AdminServiceResourceRequirementItem = {
      key: "s",
      resourceType: "staff",
      resourceTypeLabel: "کارمند",
      quantity: 1,
      necessity: "required",
      selectionMode: "any_of_type",
      specificSemantics: "unknown",
      selectedResources: [],
      branchScope: "global",
      providerSelectable: false,
    };
    expect(requirementInvolvesInternalResources(internal)).toBe(true);
  });

  it("draft summary matches structured item summary", () => {
    const line = buildSummaryLineFromDraft({
      key: "d",
      resourceType: "chair",
      quantity: 2,
      necessity: "optional",
      selectionMode: "any_of_type",
      selectedResourceIds: [],
      branchScope: "global",
    });
    expect(line).toContain("اختیاری");
    expect(line).toContain("صندلی");
  });

  it("maps view to editable drafts", () => {
    const drafts = draftsFromView({
      serviceReference: "svc_1",
      requirements: [
        {
          key: "req_1",
          reference: "req_1",
          resourceType: "staff",
          resourceTypeLabel: "کارمند",
          quantity: 1,
          necessity: "required",
          selectionMode: "any_of_type",
          specificSemantics: "unknown",
          selectedResources: [],
          branchScope: "global",
        },
      ],
      summaryLines: [],
      duplicateTypeWarnings: [],
      emptyMapping: false,
      capabilities: {
        canEdit: true,
        canReorder: false,
        hasBranchScope: false,
        hasStaffRole: true,
        hasProviderSelectable: true,
        atomicSave: true,
      },
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.resourceType).toBe("staff");
    expect(drafts[0]?.selectedResourceNames).toEqual({});
  });

  it("adapts multi-requirement service mapping", () => {
    const view = adaptAdminServiceResourceRequirements("svc_mri", {
      serviceName: "MRI مغز",
      requirements: [
        {
          reference: "req_1",
          resourceType: "staff",
          quantity: 1,
          necessity: "required",
          selectionMode: "any_of_type",
          staffRole: "تکنسین",
        },
        {
          reference: "req_2",
          resourceType: "device",
          quantity: 1,
          necessity: "required",
          selectionMode: "specific",
          selectionSemantics: "any_one",
          selectedResources: [{ id: "dev_1", name: "MRI A", type: "device", active: true }],
        },
      ],
    });
    expect(view?.requirements).toHaveLength(2);
    expect(view?.summaryLines.some((line) => line.includes("MRI A"))).toBe(true);
  });
});
