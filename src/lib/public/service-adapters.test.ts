import { describe, expect, it } from "vitest";
import {
  adaptServiceCatalog,
  adaptServiceDetail,
  adaptServiceDeposit,
  adaptServiceListItem,
  adaptServicePrice,
  relatedProvidersFromPayload,
} from "@/lib/public/service-adapters";
import { serviceBookingHref } from "@/lib/public/service-booking";
import {
  catalogCategories,
  filterServiceCatalog,
  sanitizeCategoryParam,
  sanitizeServiceQuery,
} from "@/lib/public/service-search";
import { revalidateBookableService } from "@/lib/api/public";
import { queryKeys } from "@/lib/query/keys";

describe("service price variants", () => {
  it("maps fixed, starting, free, contact and hidden prices without calculating totals", () => {
    expect(adaptServicePrice({ priceLabel: "۲۵۰٬۰۰۰ ریال" }).kind).toBe("fixed");
    expect(adaptServicePrice({ startingFrom: true, priceLabel: "۲ میلیون" }).label).toContain("شروع از");
    expect(adaptServicePrice({ isFree: true })).toEqual({ kind: "free", label: "رایگان" });
    expect(adaptServicePrice({ contactForPrice: true }).kind).toBe("contact");
    expect(adaptServicePrice({ priceHidden: true }).kind).toBe("hidden");
    expect(adaptServicePrice({ price: 150000, currency: "IRR" }).kind).toBe("fixed");
    expect(adaptServicePrice({ price: 12.5 })).toEqual({ kind: "hidden", label: "قیمت اعلام نشده" });
  });
});

describe("service deposit variants", () => {
  it("maps deposit states from Backend fields without multiplying by price", () => {
    expect(adaptServiceDeposit({ depositRequired: false })?.kind).toBe("none");
    expect(adaptServiceDeposit({ depositLabel: "۵۰ هزار تومان" })?.kind).toBe("fixed");
    expect(adaptServiceDeposit({ depositPercent: 20 })?.label).toBe("20٪ بیعانه");
    expect(adaptServiceDeposit({ fullPaymentRequired: true })?.kind).toBe("full");
    expect(adaptServiceDeposit({ payAtLocation: true })?.kind).toBe("payAtLocation");
    expect(adaptServiceDeposit({ depositAmount: 10.5 })).toBeUndefined();
  });
});

describe("service catalog adapter", () => {
  it("keeps public active services in Backend order and drops inactive ones", () => {
    const catalog = adaptServiceCatalog({
      items: [
        { id: "svc_a", name: "ویزیت", durationMinutes: 20, priceLabel: "رایگان", isFree: true },
        { id: "svc_b", name: "بایگانی", status: "archived" },
        { id: "svc_c", name: "غیرفعال", active: false },
        { id: "svc_d", name: "سونوگرافی", bookingEnabled: false },
      ],
    });
    expect(catalog.items.map((item) => item.id)).toEqual(["svc_a", "svc_d"]);
    expect(catalog.paginated).toBe(false);
    expect(catalog.items[1]?.availability).toBe("bookingDisabled");
    expect(catalog.items[1]?.bookingEnabled).toBe(false);
  });

  it("does not copy internal resource fields", () => {
    const item = adaptServiceListItem({
      id: "svc_1",
      name: "ام‌آرآی",
      roomName: "اتاق ۳",
      device: "MRI",
      chair: "صندلی ۷",
      requiredResources: ["bed"],
    });
    expect(JSON.stringify(item)).not.toMatch(/اتاق ۳|MRI|صندلی ۷|bed/);
  });

  it("strips HTML from customer-facing copy", () => {
    const item = adaptServiceListItem({
      id: "svc_1",
      name: "<b>ویزیت</b>",
      shortDescription: "<script>x</script>توضیح",
    });
    expect(item?.name).toBe("ویزیت");
    expect(item?.shortDescription).toBe("توضیح");
  });
});

describe("service detail adapter", () => {
  it("maps a public detail payload including nested providers", () => {
    const detail = adaptServiceDetail({
      id: "svc_1",
      name: "ویزیت",
      description: "شرح کامل",
      durationMinutes: 30,
      priceLabel: "۲۵۰ هزار",
      temporarilyUnavailable: true,
    });
    expect(detail?.description).toBe("شرح کامل");
    expect(detail?.availability).toBe("unavailable");
    expect(detail?.bookingEnabled).toBe(false);
  });

  it("returns nested public providers and hides internal kinds", () => {
    const providers = relatedProvidersFromPayload({
      providers: [
        { id: "p1", name: "کارشناس", isPublic: true, title: "متخصص" },
        { id: "room_1", name: "اتاق", kind: "room", isPublic: true },
      ],
    });
    expect(providers.map((item) => item.id)).toEqual(["p1"]);
  });
});

describe("service search and filters", () => {
  const catalog = adaptServiceCatalog({
    items: [
      { id: "svc_1", name: "ویزیت عمومی", category: { id: "cat_a", name: "عمومی" } },
      { id: "svc_2", name: "ام‌آرآی", category: { id: "cat_b", name: "تصویربرداری" } },
    ],
  });

  it("filters the full catalog by name", () => {
    expect(filterServiceCatalog(catalog, { q: "ام‌آرآی" }).map((item) => item.id)).toEqual(["svc_2"]);
  });

  it("ignores invalid category URL values", () => {
    expect(sanitizeCategoryParam("../evil", catalogCategories(catalog.items).map((item) => item.id))).toBeUndefined();
    expect(sanitizeCategoryParam("cat_a", ["cat_a"])).toBe("cat_a");
  });

  it("does not client-filter a paginated subset", () => {
    const paged = { ...catalog, paginated: true };
    expect(filterServiceCatalog(paged, { q: "ام‌آرآی" })).toHaveLength(2);
  });

  it("trims search queries", () => {
    expect(sanitizeServiceQuery("  ویزیت  ")).toBe("ویزیت");
    expect(sanitizeServiceQuery("   ")).toBeUndefined();
  });
});

describe("booking handoff", () => {
  it("builds a safe service intent URL and refuses unbookable services", () => {
    const bookable = adaptServiceListItem({ id: "svc_1", name: "ویزیت" });
    expect(serviceBookingHref(bookable!)).toBe("/booking?service=svc_1");
    const disabled = adaptServiceListItem({ id: "svc_2", name: "ویزیت", bookingEnabled: false });
    expect(serviceBookingHref(disabled!)).toBeNull();
    expect(serviceBookingHref({ id: "/evil", bookingEnabled: true, availability: "bookable" })).toBeNull();
  });

  it("exposes a revalidation helper for the future Booking Wizard", () => {
    expect(typeof revalidateBookableService).toBe("function");
    expect(queryKeys.services.detail("svc_1")).toEqual(["public", "services", "detail", "svc_1"]);
    expect(queryKeys.services.list({ q: "mri" })).toEqual(["public", "services", "list", { q: "mri" }]);
  });
});
