import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminNotificationPreviewPanel } from "@/features/admin/notifications/admin-notification-preview-panel";
import type { AdminNotificationPreviewResult } from "@/types/admin-notification";

function renderEmail(preview: Partial<AdminNotificationPreviewResult>) {
  render(
    <AdminNotificationPreviewPanel
      channel="email"
      preview={{ warnings: [], invalidVariables: [], ...preview }}
    />,
  );
  return screen.getByTitle("پیش‌نمایش ایمیل");
}

describe("AdminNotificationPreviewPanel email preview", () => {
  it("renders template HTML as inert text inside a fully sandboxed frame", () => {
    const frame = renderEmail({
      emailBodyHtml: 'سلام <b>مشتری</b>\n<img src=x onerror="alert(1)"',
    });
    const doc = frame.getAttribute("srcdoc") ?? "";
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(doc).toContain("سلام مشتری<br>");
    expect(doc).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;");
    expect(doc).not.toMatch(/<img/i);
  });

  it("only accepts known text directions", () => {
    const frame = renderEmail({
      emailBodyHtml: "متن",
      direction: '"><script>alert(1)</script>' as AdminNotificationPreviewResult["direction"],
    });
    expect(frame.getAttribute("srcdoc")).toContain('<html dir="rtl">');
  });
});
