import { describe, expect, it } from "vitest";
import {
  adaptAdminNotificationLogDetail,
  adaptAdminNotificationLogList,
  adaptAdminNotificationLogListItem,
  adaptAdminNotificationPreviewResult,
  adaptAdminNotificationTemplateDetail,
  adaptAdminNotificationTemplateList,
  adaptAdminNotificationTemplateListItem,
  adaptAdminNotificationToggleImpactPreview,
  isAdminNotificationConflict,
  parseAdminNotificationDeliveryStatus,
  parseAdminNotificationEventType,
  validateAdminNotificationTemplateSave,
} from "@/lib/admin/notification-adapter";
import {
  adminNotificationLogFiltersApplied,
  adminNotificationLogsHref,
  adminNotificationTemplateFiltersApplied,
  adminNotificationTemplatesHref,
  notificationPermission,
  parseAdminNotificationLogFilters,
  parseAdminNotificationTemplateFilters,
} from "@/lib/admin/notification-filters";
import {
  estimateSmsLength,
  extractTemplateTokens,
  findUnknownTemplateTokens,
} from "@/lib/admin/notification-sms";

describe("admin notification adapter", () => {
  it("maps known and unknown event types", () => {
    expect(parseAdminNotificationEventType("booking_confirmation")).toBe("booking_confirmation");
    expect(parseAdminNotificationEventType("weird")).toBe("unknown");
  });

  it("keeps sent and delivered distinct", () => {
    expect(parseAdminNotificationDeliveryStatus("sent")).toBe("sent");
    expect(parseAdminNotificationDeliveryStatus("delivered")).toBe("delivered");
    expect(parseAdminNotificationDeliveryStatus("mystery")).toBe("unknown");
    expect(parseAdminNotificationDeliveryStatus("success")).toBe("delivered");
  });

  it("maps template list items with separate channel and event labels", () => {
    const item = adaptAdminNotificationTemplateListItem({
      reference: "NT-1",
      eventType: "reminder",
      channel: "sms",
      language: "fa",
      enabled: true,
      allowedActions: { view: true, edit: true },
    });
    expect(item?.reference).toBe("NT-1");
    expect(item?.channel).toBe("sms");
    expect(item?.detailHref).toContain("/admin/notifications/templates/NT-1");
  });

  it("masks recipient in log list and never exposes raw phone", () => {
    const item = adaptAdminNotificationLogListItem({
      reference: "LOG-1",
      eventType: "payment",
      channel: "email",
      maskedRecipient: "a***@example.com",
      status: "sent",
      sentAtLabel: "امروز",
    });
    expect(item?.maskedRecipient).toBe("a***@example.com");
    expect(item?.deliveryStatus).toBe("sent");
    expect(item?.deliveryStatusLabel).toBeTruthy();
  });

  it("validates unknown template variables", () => {
    const errors = validateAdminNotificationTemplateSave(
      { content: { smsBody: "سلام {{customer_name}} {{secret_var}}" } },
      "sms",
      [{ token: "customer_name", label: "نام" }],
    );
    expect(errors.smsBody).toMatch(/secret_var/);
  });

  it("adapts preview with invalid variable warnings", () => {
    const preview = adaptAdminNotificationPreviewResult({
      smsBody: "سلام علی",
      invalidVariables: ["bad_token"],
      warnings: ["متغیر bad_token پشتیبانی نمی‌شود"],
    });
    expect(preview?.invalidVariables).toContain("bad_token");
    expect(preview?.warnings.length).toBe(1);
  });

  it("distinguishes empty log history from filtered no-results", () => {
    const empty = adaptAdminNotificationLogList({ items: [], totalCount: 0 }, {
      eventType: "all",
      channel: "all",
      status: "all",
      sort: "sentAt",
      direction: "desc",
      page: 1,
    });
    expect(empty.emptyHistory).toBe(true);

    const filtered = adaptAdminNotificationLogList(
      { items: [], totalCount: 0 },
      {
        eventType: "all",
        channel: "all",
        status: "failed",
        sort: "sentAt",
        direction: "desc",
        page: 1,
      },
    );
    expect(filtered.emptyHistory).toBe(false);
    expect(filtered.filtersApplied).toBe(true);
  });

  it("adapts log detail timeline without secrets", () => {
    const detail = adaptAdminNotificationLogDetail({
      reference: "LOG-9",
      channel: "sms",
      maskedRecipient: "09**",
      status: "failed",
      eventType: "cancellation",
      timeline: [
        { status: "queued", atLabel: "۱۰:۰۰" },
        { status: "sent", atLabel: "۱۰:۰۱" },
        { status: "failed", atLabel: "۱۰:۰۲", detail: "Provider rejected" },
      ],
      allowedActions: { retry: true },
    });
    expect(detail?.timeline).toHaveLength(3);
    expect(detail?.allowedActions.retry).toBe(true);
    expect(JSON.stringify(detail)).not.toMatch(/api[_-]?key|password|secret/i);
  });

  it("detects admin notification conflicts", () => {
    expect(isAdminNotificationConflict({ status: 409, code: "VERSION_MISMATCH" })).toBe(true);
  });
});

describe("admin notification filters", () => {
  it("parses and serializes template URL filters", () => {
    const filters = parseAdminNotificationTemplateFilters(
      new URLSearchParams("eventType=reminder&channel=sms&status=enabled&page=2"),
    );
    expect(filters.eventType).toBe("reminder");
    expect(filters.channel).toBe("sms");
    expect(adminNotificationTemplatesHref(filters)).toContain("eventType=reminder");
    expect(adminNotificationTemplateFiltersApplied(filters)).toBe(true);
  });

  it("parses log date range filters", () => {
    const filters = parseAdminNotificationLogFilters(
      new URLSearchParams("from=2026-08-01&to=2026-08-31&status=failed"),
    );
    expect(filters.from).toBe("2026-08-01");
    expect(adminNotificationLogFiltersApplied(filters)).toBe(true);
    expect(adminNotificationLogsHref(filters)).toContain("status=failed");
  });
});

describe("notification sms utilities", () => {
  it("estimates gsm and unicode segments", () => {
    const gsm = estimateSmsLength("Hello");
    expect(gsm.encoding).toBe("gsm7");
    expect(gsm.segmentCount).toBe(1);

    const unicode = estimateSmsLength("سلام");
    expect(unicode.encoding).toBe("unicode");
  });

  it("extracts template tokens and finds unknown ones", () => {
    expect(extractTemplateTokens("{{a}} and {{b}}")).toEqual(["a", "b"]);
    expect(findUnknownTemplateTokens("{{a}} {{c}}", ["a", "b"])).toEqual(["c"]);
  });
});

describe("notification permissions", () => {
  it("maps permission codes", () => {
    expect(notificationPermission("templatesEdit")).toBe("admin.notifications.templates.edit");
    expect(notificationPermission("logsRetry")).toBe("admin.notifications.logs.retry");
  });
});

describe("template detail adapter", () => {
  it("adapts email and sms content separately", () => {
    const sms = adaptAdminNotificationTemplateDetail({
      reference: "NT-SMS",
      eventType: "reminder",
      channel: "sms",
      content: { smsBody: "test" },
      variables: [],
    });
    expect(sms?.content.smsBody).toBe("test");

    const email = adaptAdminNotificationTemplateDetail({
      reference: "NT-EM",
      eventType: "payment",
      channel: "email",
      content: { emailSubject: "sub", emailBody: "body" },
      variables: [],
    });
    expect(email?.content.emailSubject).toBe("sub");
    expect(email?.content.emailBody).toBe("body");
  });

  it("adapts toggle impact preview", () => {
    const preview = adaptAdminNotificationToggleImpactPreview({
      title: "غیرفعال‌سازی",
      summary: "یادآوری ارسال نمی‌شود",
      effects: ["SMS غیرفعال می‌شود"],
      fallbackChannelLabel: "ایمیل",
    });
    expect(preview?.fallbackChannelLabel).toBe("ایمیل");
  });
});

describe("template list adapter", () => {
  it("maps list view empty history", () => {
    const list = adaptAdminNotificationTemplateList({ items: [], totalCount: 0 }, {
      eventType: "all",
      channel: "all",
      status: "all",
      sort: "updatedAt",
      direction: "desc",
      page: 1,
    });
    expect(list.emptyHistory).toBe(true);
  });
});
