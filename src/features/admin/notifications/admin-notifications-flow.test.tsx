import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminNotificationTemplatesScreen } from "@/features/admin/notifications/admin-notification-templates-screen";
import { AdminNotificationTemplateDetailScreen } from "@/features/admin/notifications/admin-notification-template-detail-screen";
import { AdminNotificationLogsScreen } from "@/features/admin/notifications/admin-notification-logs-screen";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

/** E2E: Admin → Templates → Edit SMS → Insert Variable → Preview → Save → Logs */

const replaceMock = vi.fn();
const pushMock = vi.fn();
let params = { templateReference: "NT-1" };
let pathnameMock = "/admin/notifications/templates";

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock,
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => params,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("Phase 38 admin notifications E2E flow", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replaceMock.mockReset();
    pushMock.mockReset();
    params = { templateReference: "NT-1" };
    pathnameMock = "/admin/notifications/templates";
  });

  it("walks templates → edit SMS → preview → save → delivery logs", async () => {
    const user = userEvent.setup();
    const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });
    let saved = false;

    mockedClient.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
      const url = String(path);
      const method = init?.method ?? "GET";
      if (method === "GET" && url.startsWith("/admin/notifications/templates?")) {
        return {
          items: [
            {
              reference: "NT-1",
              eventType: "booking_confirmation",
              channel: "sms",
              language: "fa",
              enabled: true,
              allowedActions: { view: true, edit: true },
            },
          ],
          totalCount: 1,
          pageCount: 1,
        };
      }
      if (url.includes("/preview") && method === "POST") {
        return {
          smsBody: "سلام علی، نوبت شما تأیید شد.",
          warnings: [],
          invalidVariables: [],
          characterCountLabel: "۲۸ کاراکتر",
        };
      }
      if (url.includes("/admin/notifications/templates/NT-1") && method === "PATCH") {
        saved = true;
        return {
          reference: "NT-1",
          eventType: "booking_confirmation",
          channel: "sms",
          language: "fa",
          enabled: true,
          content: { smsBody: "سلام {{customer_name}}، نوبت تأیید شد." },
          variables: [{ token: "customer_name", label: "نام مشتری", sampleValue: "علی" }],
          allowedActions: { view: true, edit: true, preview: true },
        };
      }
      if (url.includes("/admin/notifications/templates/NT-1")) {
        return {
          reference: "NT-1",
          eventType: "booking_confirmation",
          channel: "sms",
          language: "fa",
          enabled: true,
          content: { smsBody: saved ? "سلام {{customer_name}}، نوبت تأیید شد." : "سلام، نوبت تأیید شد." },
          variables: [{ token: "customer_name", label: "نام مشتری", sampleValue: "علی" }],
          allowedActions: { view: true, edit: true, preview: true },
          version: saved ? "v2" : "v1",
        };
      }
      if (method === "GET" && url.includes("/admin/notifications/logs")) {
        return {
          items: [
            {
              reference: "LOG-1",
              eventType: "booking_confirmation",
              channel: "sms",
              maskedRecipient: "09**",
              status: "delivered",
              sentAtLabel: "امروز",
            },
          ],
          totalCount: 1,
          pageCount: 1,
        };
      }
      return {};
    });

    const listView = renderWithProviders(<AdminNotificationTemplatesScreen />, { session });
    expect((await screen.findAllByText(/تأیید نوبت/i)).length).toBeGreaterThan(0);
    listView.unmount();

    params = { templateReference: "NT-1" };
    const detailRender = renderWithProviders(<AdminNotificationTemplateDetailScreen />, { session });
    expect(await screen.findByLabelText(/متن پیامک/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "درج در متن" }));
    await user.click(screen.getByRole("button", { name: "پیش‌نمایش" }));
    expect(await screen.findByText(/سلام علی/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ذخیره" }));
    await waitFor(() => expect(saved).toBe(true));
    detailRender.unmount();

    pathnameMock = "/admin/notifications/logs";
    renderWithProviders(<AdminNotificationLogsScreen />, { session });
    expect((await screen.findAllByText("09**")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/تحویل‌شده/i)).length).toBeGreaterThan(0);
  });

  it("strips script content from preview html via safe text", async () => {
    mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
      const url = String(path);
      if (url.includes("/preview") && init?.method === "POST") {
        return {
          emailSubject: "Test",
          emailBodyHtml: "<script>alert(1)</script><p>Safe</p>",
          warnings: [],
          invalidVariables: [],
        };
      }
      if (url.includes("/admin/notifications/templates/NT-EM")) {
        return {
          reference: "NT-EM",
          eventType: "payment",
          channel: "email",
          language: "fa",
          enabled: true,
          content: { emailSubject: "Test", emailBody: "<script>x</script>" },
          variables: [],
          allowedActions: { preview: true, edit: true },
        };
      }
      return {};
    });

    params = { templateReference: "NT-EM" };
    const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });
    const user = userEvent.setup();
    renderWithProviders(<AdminNotificationTemplateDetailScreen />, { session });
    await user.click(await screen.findByRole("button", { name: "پیش‌نمایش" }));
    await waitFor(() => expect(screen.getByTitle("پیش‌نمایش ایمیل")).toBeInTheDocument());
    expect(screen.queryByText("alert(1)")).not.toBeInTheDocument();
  });
});
