import { describe, expect, it } from "vitest";
import { env } from "@/config/env";
import {
  adaptPublicBranches,
  adaptPublicBusiness,
  adaptPublicProviders,
  adaptPublicServices,
  configuredPublicBusiness,
  hasAboutContent,
} from "@/lib/public/adapters";
import { bookingHref, isSafePublicId } from "@/lib/public/booking-href";
import { mailtoHref, telHref } from "@/lib/public/links";
import { buildHomeMetadata } from "@/lib/public/metadata";
import { displayOrder, isOpenNow, weekdayLabel } from "@/lib/public/working-hours";

describe("public business adapter", () => {
  it("maps a successful nested profile payload", () => {
    const business = adaptPublicBusiness({
      data: {
        name: "مرکز تصویربرداری نور",
        shortDescription: "تصویربرداری تشخیصی",
        phone: "02112345678",
        bookingEnabled: true,
        selectableProviders: false,
      },
    });
    expect(business?.name).toBe("مرکز تصویربرداری نور");
    expect(business?.phone).toBe("02112345678");
    expect(business?.bookingEnabled).toBe(true);
    expect(business?.providerPresentationEnabled).toBe(false);
  });

  it("treats missing booking flag as enabled", () => {
    expect(adaptPublicBusiness({ name: "سالن گل" })?.bookingEnabled).toBe(true);
  });

  it("uses configured identity without inventing catalog data", () => {
    const business = configuredPublicBusiness();
    expect(business.name).toBe(env.appName);
    expect(business.tagline).toBe(env.appTagline);
    expect(business.bookingEnabled).toBe(true);
    expect(business.providerPresentationEnabled).toBe(false);
    expect(business.branchesEnabled).toBe(false);
    expect(business.workingHours).toEqual([]);
    expect(business.socialLinks).toEqual([]);
  });
});

describe("featured services adapter", () => {
  it("keeps active services and backend order, dropping inactive ones", () => {
    const services = adaptPublicServices({
      items: [
        { id: "svc_a", name: "ام‌آرآی", durationMinutes: 40, priceLabel: "از ۲ میلیون" },
        { id: "svc_b", name: "بایگانی‌شده", status: "archived" },
        { id: "svc_c", name: "سی‌تی", active: false },
      ],
    });
    expect(services.map((item) => item.id)).toEqual(["svc_a"]);
    expect(services[0]?.durationMinutes).toBe(40);
    expect(services[0]?.priceLabel).toBe("از ۲ میلیون");
  });

  it("prefers featured services when flagged", () => {
    const services = adaptPublicServices([
      { id: "svc_1", name: "عادی" },
      { id: "svc_2", name: "ویژه", featured: true },
    ]);
    expect(services).toHaveLength(1);
    expect(services[0]?.id).toBe("svc_2");
  });
});

describe("public provider filtering", () => {
  it("hides internal operational resources and private staff", () => {
    const providers = adaptPublicProviders([
      { id: "p1", name: "دکتر رضایی", isPublic: true, title: "متخصص" },
      { id: "room_1", name: "اتاق ۱", kind: "room", isPublic: true },
      { id: "chair_1", name: "صندلی ۳", type: "chair" },
      { id: "p2", name: "کارشناس داخلی", isPublic: false },
    ]);
    expect(providers.map((item) => item.id)).toEqual(["p1"]);
  });
});

describe("branch adapter", () => {
  it("returns only active public branches", () => {
    const branches = adaptPublicBranches([
      { id: "br_1", name: "شعبه مرکزی", address: "خیابان اصلی" },
      { id: "br_2", name: "شعبه تعطیل", active: false },
    ]);
    expect(branches).toHaveLength(1);
    expect(branches[0]?.name).toBe("شعبه مرکزی");
  });
});

describe("safe booking links", () => {
  it("accepts internal ids and rejects unsafe values", () => {
    expect(bookingHref({ serviceId: "svc_1" })).toBe("/booking?service=svc_1");
    expect(bookingHref({ branchId: "br_2", providerId: "p_9" })).toBe(
      "/booking?provider=p_9&branch=br_2",
    );
    expect(isSafePublicId("https://evil.example")).toBe(false);
    expect(bookingHref({ serviceId: "/evil" })).toBe("/booking");
    expect(bookingHref({ serviceId: "svc_1", repeatFrom: "apt_1" })).toBe(
      "/booking?service=svc_1&repeatFrom=apt_1",
    );
    expect(bookingHref({ serviceId: "svc_1", repeatFrom: "12" })).toBe("/booking?service=svc_1");
  });
});

describe("contact hrefs", () => {
  it("builds tel and mailto links", () => {
    expect(telHref("021-12345678")).toBe("tel:02112345678");
    expect(mailtoHref("info@example.com")).toBe("mailto:info@example.com");
    expect(mailtoHref("not-an-email")).toBeUndefined();
  });
});

describe("working hours", () => {
  it("renders saturday-first order and closed days", () => {
    const business = adaptPublicBusiness({
      name: "کلینیک",
      workingHours: {
        saturday: "09:00-17:00",
        friday: "closed",
      },
    });
    const ordered = displayOrder(business?.workingHours ?? []);
    expect(ordered[0]?.label).toBe(weekdayLabel(6));
    expect(ordered.find((day) => day.weekday === 5)?.closed).toBe(true);
  });

  it("does not claim open-now without a timezone", () => {
    expect(isOpenNow([{ id: "6", weekday: 6, label: "شنبه", closed: false, special: false, holiday: false, ranges: [{ start: "09:00", end: "17:00" }] }], undefined)).toBeNull();
  });
});

describe("optional about content", () => {
  it("hides about when no public copy exists", () => {
    const business = adaptPublicBusiness({ name: "سالن" });
    expect(business && hasAboutContent(business)).toBe(false);
  });
});

describe("home metadata", () => {
  it("uses business identity without fake ratings", () => {
    const metadata = buildHomeMetadata({
      name: "مرکز نمونه",
      shortDescription: "خدمات نوبت‌دهی",
      socialLinks: [],
      bookingEnabled: true,
      providerPresentationEnabled: false,
      branchesEnabled: false,
      workingHours: [],
      contactHours: [],
    });
    expect(metadata.title).toBe("مرکز نمونه");
    expect(metadata.description).toBe("خدمات نوبت‌دهی");
    expect(JSON.stringify(metadata)).not.toMatch(/امتیاز|review/i);
  });
});
