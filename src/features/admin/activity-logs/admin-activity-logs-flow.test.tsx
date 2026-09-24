import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { AdminActivityLogsScreen } from "@/features/admin/activity-logs/admin-activity-logs-screen";
import { AdminActivityLogDetailScreen } from "@/features/admin/activity-logs/admin-activity-log-detail-screen";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

/** E2E: Open logs → filter → open detail → inspect changes → related entity link */

const replaceMock = vi.fn();
let search = new URLSearchParams();
let params: Record<string, string> = {};

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/activity-logs",
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => search,
  useParams: () => params,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("Phase 42 activity logs flow", () => {
  beforeEach(() => {
    cleanup();
    mockedClient.mockReset();
    replaceMock.mockReset();
    search = new URLSearchParams();
    params = {};
  });

  it("filters list, opens detail with sanitized changes, and links related entity", async () => {
    const session = createSessionValue({
      status: "authenticated",
      user: { ...authenticatedAdmin, permissionCodes: [] },
    });

    mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
      const url = String(path);
      const method = init?.method ?? "GET";

      if (method === "GET" && url.startsWith("/admin/activity-logs?")) {
        const filtered = url.includes("action=appointment.cancelled");
        return {
          items: filtered
            ? [
                {
                  reference: "LOG-42",
                  actorLabel: "مدیر تست",
                  actionCode: "appointment.cancelled",
                  entityType: "appointment",
                  entityReference: "APT-9",
                  summary: "لغو نوبت",
                  occurredAt: "2026-08-20T08:00:00.000Z",
                  result: "success",
                  entityAvailable: true,
                },
              ]
            : [
                {
                  reference: "LOG-1",
                  actorLabel: "مدیر تست",
                  actionCode: "staff.updated",
                  entityType: "staff",
                  entityReference: "STF-1",
                  summary: "ویرایش پرسنل",
                  occurredAt: "2026-08-19T08:00:00.000Z",
                  result: "success",
                },
              ],
          totalCount: 1,
          emptyHistory: false,
          filterOptions: {
            actions: [
              { id: "appointment.cancelled", label: "لغو نوبت" },
              { id: "staff.updated", label: "به‌روزرسانی پرسنل" },
            ],
          },
          capabilities: { supportsExport: false, supportsBranchFilter: false },
          allowedActions: { view: true },
        };
      }

      if (method === "GET" && url === "/admin/activity-logs/LOG-42") {
        return {
          reference: "LOG-42",
          actorLabel: "مدیر تست",
          actionCode: "appointment.cancelled",
          entityType: "appointment",
          entityReference: "APT-9",
          entityAvailable: true,
          summary: "لغو نوبت مشتری",
          occurredAt: "2026-08-20T08:00:00.000Z",
          result: "success",
          changes: [
            {
              fieldKey: "status",
              fieldLabel: "وضعیت",
              kind: "changed",
              previous: "confirmed",
              next: "cancelled",
            },
            {
              fieldKey: "password",
              fieldLabel: "رمز",
              kind: "changed",
              previous: "secret",
              next: "secret2",
            },
          ],
          allowedActions: {
            view: true,
            viewDetail: true,
            viewChanges: true,
            viewPrivate: false,
          },
        };
      }

      throw new Error(`Unexpected ${method} ${url}`);
    });

    renderWithProviders(<AdminActivityLogsScreen />, { session });
    expect((await screen.findAllByText("ویرایش پرسنل")).length).toBeGreaterThan(0);

    search = new URLSearchParams("action=appointment.cancelled");
    cleanup();
    renderWithProviders(<AdminActivityLogsScreen />, { session });

    expect((await screen.findAllByText("لغو نوبت")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "جزئیات" })[0]).toHaveAttribute(
      "href",
      "/admin/activity-logs/LOG-42",
    );

    params = { logReference: "LOG-42" };
    cleanup();
    renderWithProviders(<AdminActivityLogDetailScreen />, { session });

    expect((await screen.findAllByText("لغو نوبت مشتری")).length).toBeGreaterThan(0);
    expect(screen.getByText("وضعیت")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("تغییر یافته").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("••••••••").length).toBeGreaterThan(0);

    const entityLink = screen.getByRole("link", { name: /نوبت APT-9/i });
    expect(entityLink).toHaveAttribute("href", "/admin/appointments/APT-9");
  });
});
