import { describe, expect, it } from "vitest";
import {
  adaptAdminServiceDetail,
  adaptAdminServiceList,
  adminServiceToCustomerPreview,
  formFromAdminServiceDetail,
  validateAdminServiceForm,
} from "@/lib/admin/service-adapter";

describe("service-adapter", () => {
  it("adapts admin service list", () => {
    const view = adaptAdminServiceList(
      {
        items: [
          {
            id: "svc_1",
            reference: "svc_1",
            name: "MRI مغز",
            durationMinutes: 45,
            priceLabel: "۵۰۰٬۰۰۰ ریال",
            priceType: "fixed",
            depositType: "none",
            lifecycle: "active",
            sortOrder: 1,
          },
        ],
        totalCount: 1,
      },
      1,
    );
    expect(view.items).toHaveLength(1);
    expect(view.items[0]?.name).toBe("MRI مغز");
  });

  it("adapts service detail", () => {
    const view = adaptAdminServiceDetail({
      id: "svc_1",
      reference: "svc_1",
      name: "ویزیت",
      durationMinutes: 30,
      bufferBeforeMinutes: 5,
      capacity: 2,
      priceType: "fixed",
      price: 250000,
      currency: "IRR",
      depositType: "percentage",
      depositPercent: 20,
      providerMode: "selectable",
      lifecycle: "active",
    });
    expect(view?.bufferBeforeMinutes).toBe(5);
    expect(view?.providerMode).toBe("selectable");
  });

  it("validates service form", () => {
    const errors = validateAdminServiceForm({
      name: "",
      priceMode: "fixed",
      depositMode: "none",
      branchIds: [],
      providerIds: [],
      providerMode: "auto",
      bookingEnabled: true,
    });
    expect(errors.name).toBeTruthy();
  });

  it("maps customer preview without internal fields", () => {
    const preview = adminServiceToCustomerPreview(
      formFromAdminServiceDetail(
        adaptAdminServiceDetail({
          id: "svc_1",
          reference: "svc_1",
          name: "خدمت آزمایشی",
          shortDescription: "توضیح کوتاه",
          durationMinutes: 20,
          priceType: "fixed",
          price: 100000,
          currency: "IRR",
          depositType: "none",
          lifecycle: "active",
          bookingEnabled: true,
        })!,
      ),
    );
    expect(preview.name).toBe("خدمت آزمایشی");
    expect(JSON.stringify(preview)).not.toMatch(/buffer/i);
    expect(JSON.stringify(preview)).not.toMatch(/requirement/i);
  });
});
