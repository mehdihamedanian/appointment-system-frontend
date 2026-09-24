import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminReportsScreen } from "@/features/admin/reports/admin-reports-screen";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

/** E2E: Admin → Reports → Date/Branch → Open Report → Compare → Export */

const replaceMock = vi.fn();
const pushMock = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/reports",
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => search,
  useParams: () => ({}),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

async function chooseSelectOption(
  user: ReturnType<typeof userEvent.setup>,
  label: RegExp,
  optionName: string | RegExp,
) {
  const trigger = await screen.findByLabelText(label);
  await user.click(trigger);
  const listbox = await screen.findByRole("listbox");
  await user.click(within(listbox).getByRole("option", { name: optionName }));
}

describe("Phase 39 admin reports E2E flow", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replaceMock.mockReset();
    pushMock.mockReset();
    search = new URLSearchParams();
  });

  it("walks reports → filters → compare → export with same filters", async () => {
    const user = userEvent.setup();
    const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });
    let exportCreated = false;
    let lastExportBody: Record<string, string> | undefined;

    mockedClient.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
      const url = String(path);
      const method = init?.method ?? "GET";

      if (url.includes("/admin/reports/meta")) {
        return {
          timezone: "Asia/Tehran",
          maxRangeDays: 366,
          branchesEnabled: true,
          supportedReports: ["revenue", "bookings", "peak"],
          presets: ["today", "last_7_days", "last_30_days", "custom"],
          comparisonModes: ["none", "previous_period"],
          filterOptions: {
            branches: [{ id: "br_1", label: "شعبه مرکزی" }],
          },
        };
      }

      if (method === "POST" && url.includes("/admin/reports/export")) {
        exportCreated = true;
        lastExportBody = init?.body as Record<string, string>;
        return {
          jobId: "EXP-1",
          status: "ready",
          downloadUrl: "https://files.example/report.csv",
          reportType: "revenue",
        };
      }

      if (url.includes("/admin/reports/export/EXP-1")) {
        return {
          jobId: "EXP-1",
          status: "ready",
          downloadUrl: "https://files.example/report.csv",
        };
      }

      if (url.includes("/admin/reports/revenue")) {
        return {
          reportType: "revenue",
          timezone: "Asia/Tehran",
          range: { from: "2026-07-27", to: "2026-08-26", label: "۳۰ روز اخیر" },
          comparisonRange: { from: "2026-06-27", to: "2026-07-26", label: "بازه قبلی" },
          lastUpdatedAt: "2026-08-26T06:00:00.000Z",
          metrics: [
            {
              key: "grossRevenue",
              label: "درآمد ناخالص",
              valueLabel: "۱۰٬۰۰۰٬۰۰۰ تومان",
              comparison: {
                absoluteChangeLabel: "+۱٬۰۰۰٬۰۰۰",
                percentageChangeLabel: "۱۰٪",
                periodLabel: "نسبت به بازه قبلی",
                tone: "positive",
              },
            },
            {
              key: "netRevenue",
              label: "درآمد خالص",
              valueLabel: "۹٬۰۰۰٬۰۰۰ تومان",
            },
            {
              key: "refunded",
              label: "استرداد",
              valueLabel: "۰ تومان",
            },
          ],
          series: [
            {
              id: "daily",
              title: "روند درآمد",
              points: [
                { id: "1", label: "هفته ۱", valueLabel: "۲M", barPercent: 40 },
                { id: "2", label: "هفته ۲", valueLabel: "۵M", barPercent: 100 },
              ],
            },
          ],
          breakdown: [],
          allowedActions: { export: true },
          filterOptions: {
            branches: [{ id: "br_1", label: "شعبه مرکزی" }],
          },
        };
      }

      return {};
    });

    const firstView = renderWithProviders(<AdminReportsScreen />, { session });

    expect(await screen.findByRole("heading", { name: "گزارش‌ها" })).toBeInTheDocument();
    expect((await screen.findAllByText(/درآمد ناخالص/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/۱۰٬۰۰۰٬۰۰۰ تومان/i)).toBeInTheDocument();
    expect(screen.getByText(/نسبت به بازه قبلی/i)).toBeInTheDocument();
    expect(screen.getByText(/جدول داده‌های روند درآمد/i)).toBeInTheDocument();
    expect(screen.getAllByText("هفته ۲").length).toBeGreaterThan(0);

    await chooseSelectOption(user, /شعبه/i, /شعبه مرکزی/);
    await waitFor(() => expect(replaceMock).toHaveBeenCalled());
    expect(String(replaceMock.mock.calls.at(-1)?.[0] ?? "")).toContain("branchId=br_1");

    replaceMock.mockClear();
    await chooseSelectOption(user, /مقایسه/i, /بازه قبلی/);
    await waitFor(() => expect(replaceMock).toHaveBeenCalled());
    expect(String(replaceMock.mock.calls.at(-1)?.[0] ?? "")).toContain("comparison=previous_period");

    firstView.unmount();

    // Re-mount with URL-preserved filters for export
    search = new URLSearchParams("comparison=previous_period&branchId=br_1");
    renderWithProviders(<AdminReportsScreen />, { session });
    expect(await screen.findByText(/۱۰٬۰۰۰٬۰۰۰ تومان/i)).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /خروجی با فیلتر فعلی/i }));
    await waitFor(() => expect(exportCreated).toBe(true));
    expect(lastExportBody?.report).toBe("revenue");
    expect(lastExportBody?.comparison).toBe("previous_period");
    expect(lastExportBody?.branchId).toBe("br_1");
    expect(await screen.findByRole("button", { name: /دانلود/i })).toBeInTheDocument();
  });

  it("shows unavailable metric as dash not zero", async () => {
    search = new URLSearchParams("report=bookings");
    mockedClient.mockImplementation(async (path: string) => {
      const url = String(path);
      if (url.includes("/admin/reports/meta")) {
        return { supportedReports: ["bookings"], branchesEnabled: false };
      }
      if (url.includes("/admin/reports/bookings")) {
        return {
          reportType: "bookings",
          range: { from: "2026-08-01", to: "2026-08-26" },
          metrics: [
            { key: "total", label: "کل نوبت‌ها", value: 0, valueLabel: "۰" },
            { key: "cancelRate", label: "نرخ لغو", state: "unavailable" },
          ],
          series: [],
          breakdown: [],
          allowedActions: { export: false },
        };
      }
      return {};
    });

    const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });
    renderWithProviders(<AdminReportsScreen />, { session });
    expect(await screen.findByText("کل نوبت‌ها")).toBeInTheDocument();
    expect(screen.getByText("۰")).toBeInTheDocument();
    expect(screen.getByText("نرخ لغو")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
