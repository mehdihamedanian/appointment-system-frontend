import { describe, expect, it } from "vitest";
import {
  adaptCustomerNotification,
  adaptCustomerNotificationList,
  clampUnreadBadge,
  parseNotificationType,
} from "@/lib/customer/notification-adapter";
import { resolveNotificationDeepLink } from "@/lib/customer/notification-deep-link";
import { notificationsHref, parseNotificationReadFilter } from "@/lib/customer/notification-filters";

describe("notification adapter", () => {
  it("maps known types and falls back safely for unknown types", () => {
    expect(parseNotificationType("appointment_reminder")).toBe("appointment_reminder");
    expect(parseNotificationType("weird_event")).toBe("unknown");
    const item = adaptCustomerNotification({
      id: "n1",
      type: "totally_new",
      title: "پیام",
      createdAt: "2026-08-22T10:00:00.000Z",
      read: false,
    });
    expect(item?.type).toBe("unknown");
    expect(item?.title).toBe("پیام");
  });

  it("never renders HTML payloads as markup-capable fields", () => {
    const item = adaptCustomerNotification({
      id: "n2",
      title: "<b>unsafe</b>",
      body: "<script>alert(1)</script>hello",
      createdAt: "2026-08-22T10:00:00.000Z",
    });
    // asSafeText strips tags; ensure no raw script tag remains as-is for render
    expect(item?.title.includes("<script")).toBe(false);
    expect(item?.message?.includes("<script")).toBe(false);
  });

  it("distinguishes empty inbox from filtered no-results", () => {
    const empty = adaptCustomerNotificationList(
      { items: [] },
      { page: 1, readFilter: "all" },
    );
    expect(empty.emptyInbox).toBe(true);
    const filtered = adaptCustomerNotificationList(
      { items: [] },
      { page: 1, readFilter: "unread" },
    );
    expect(filtered.filtersApplied).toBe(true);
    expect(filtered.emptyInbox).toBe(false);
  });

  it("clamps unread badge visually while keeping numeric source separate", () => {
    expect(clampUnreadBadge(0)).toBe("");
    expect(clampUnreadBadge(3)).toBe("۳");
    expect(clampUnreadBadge(120)).toBe("۹۹+");
  });
});

describe("notification deep links", () => {
  it("builds internal appointment and payment links from entity metadata", () => {
    expect(
      resolveNotificationDeepLink({
        entityType: "appointment",
        entityReference: "apt_1",
      }),
    ).toBe("/appointments/apt_1");
    expect(
      resolveNotificationDeepLink({
        entityType: "payment",
        entityReference: "pay_1",
      }),
    ).toBe("/payments/pay_1");
  });

  it("rejects external and unsafe hrefs", () => {
    expect(
      resolveNotificationDeepLink({
        href: "https://evil.example/phish",
      }),
    ).toBeUndefined();
    expect(
      resolveNotificationDeepLink({
        href: "javascript:alert(1)",
      }),
    ).toBeUndefined();
    expect(
      resolveNotificationDeepLink({
        href: "/admin/customers",
      }),
    ).toBeUndefined();
  });

  it("accepts approved internal href fallback", () => {
    expect(resolveNotificationDeepLink({ href: "/appointments/apt_9" })).toBe(
      "/appointments/apt_9",
    );
  });

  it("resolves waiting-list and review destinations", () => {
    expect(
      resolveNotificationDeepLink({
        entityType: "waiting_list_offer",
        entityReference: "wl_1",
      }),
    ).toBe("/waiting-list/offers/wl_1");
    expect(
      resolveNotificationDeepLink({
        entityType: "waiting_list_entry",
        entityReference: "wle_1",
      }),
    ).toBe("/waiting-list/wle_1");
    expect(
      resolveNotificationDeepLink({
        entityType: "review_request",
        entityReference: "apt_9",
      }),
    ).toBe("/appointments/apt_9/review");
  });
});

describe("notification filters", () => {
  it("parses read filter and builds href", () => {
    expect(parseNotificationReadFilter("unread")).toBe("unread");
    expect(parseNotificationReadFilter("nope")).toBe("all");
    expect(notificationsHref({ read: "unread", page: 2 })).toBe(
      "/notifications?read=unread&page=2",
    );
  });
});
