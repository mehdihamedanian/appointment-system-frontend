import { describe, expect, it } from "vitest";
import {
  adaptAdminReportExport,
  adaptAdminReportMetric,
  adaptAdminReportMeta,
  adaptAdminReportSeries,
  adaptAdminReportView,
  formatAdminReportMetricValue,
  parseAdminReportExportStatus,
  parseAdminReportType,
} from "@/lib/admin/report-adapter";
import {
  adminReportFiltersApplied,
  adminReportsHref,
  countActiveAdminReportFilters,
  filtersToAdminReportParams,
  parseAdminReportFilters,
  pruneUnsupportedReportFilters,
  reportPermission,
  validateReportRange,
} from "@/lib/admin/report-filters";
import { clearAdminReportCaches } from "@/lib/admin/report-cache";
import { QueryClient } from "@tanstack/react-query";

describe("admin report adapter", () => {
  it("maps known and unknown report types with fallback", () => {
    expect(parseAdminReportType("bookings")).toBe("bookings");
    expect(parseAdminReportType("weird")).toBe("revenue");
  });

  it("keeps unavailable metrics distinct from zero", () => {
    const unavailable = adaptAdminReportMetric({
      key: "netRevenue",
      label: "درآمد خالص",
      state: "unavailable",
    });
    expect(unavailable?.state).toBe("unavailable");
    expect(formatAdminReportMetricValue(unavailable!).value).toBe("—");

    const zero = adaptAdminReportMetric({
      key: "bookings",
      label: "نوبت‌ها",
      value: 0,
      valueLabel: "۰",
    });
    expect(zero?.state).toBe("ready");
    expect(formatAdminReportMetricValue(zero!).value).toBe("۰");
  });

  it("accepts comparison percentage only from Backend labels", () => {
    const metric = adaptAdminReportMetric({
      key: "gross",
      label: "ناخالص",
      valueLabel: "۱۰۰",
      comparison: {
        absoluteChangeLabel: "+۱۰",
        percentageChangeLabel: "۱۰٪",
        periodLabel: "بازه قبلی",
        tone: "positive",
      },
    });
    const formatted = formatAdminReportMetricValue(metric!);
    expect(formatted.trend).toContain("۱۰٪");
    expect(formatted.comparison).toBe("بازه قبلی");
  });

  it("adapts series and empty charts without fabricating points", () => {
    const empty = adaptAdminReportSeries({ title: "روند", points: [] });
    expect(empty?.empty).toBe(true);

    const series = adaptAdminReportSeries({
      id: "trend",
      title: "نوبت روزانه",
      points: [
        { id: "d1", label: "شنبه", valueLabel: "۱۲", barPercent: 60 },
        { id: "d2", label: "یکشنبه", valueLabel: "۲۰", barPercent: 100 },
      ],
    });
    expect(series?.points).toHaveLength(2);
  });

  it("adapts full report view with peak data", () => {
    const view = adaptAdminReportView(
      {
        reportType: "peak",
        timezone: "Asia/Tehran",
        range: { from: "2026-08-01", to: "2026-08-26", label: "اوت" },
        metrics: [{ key: "peakHour", label: "اوج", valueLabel: "۱۰–۱۱" }],
        peakHours: {
          title: "ساعات",
          points: [{ label: "۱۰", valueLabel: "۵", barPercent: 50 }],
        },
        heatmap: {
          title: "نقشه",
          cells: [
            {
              rowId: "sat",
              columnId: "10",
              rowLabel: "شنبه",
              columnLabel: "۱۰",
              valueLabel: "۳",
              intensityPercent: 30,
            },
          ],
        },
        allowedActions: { export: true },
      },
      "peak",
    );
    expect(view.reportType).toBe("peak");
    expect(view.peakHours?.points).toHaveLength(1);
    expect(view.heatmap?.cells).toHaveLength(1);
    expect(view.allowedActions.export).toBe(true);
  });

  it("keeps sent export statuses and never invents ready", () => {
    expect(parseAdminReportExportStatus("processing")).toBe("processing");
    expect(parseAdminReportExportStatus("done")).toBe("ready");
    expect(parseAdminReportExportStatus("weird")).toBe("unknown");

    const exportView = adaptAdminReportExport(
      {
        jobId: "EXP-1",
        status: "ready",
        downloadUrl: "https://files.example/report.csv",
      },
      "revenue",
    );
    expect(exportView?.downloadUrl).toContain("https://");
  });

  it("adapts meta defaults when Backend omits lists", () => {
    const meta = adaptAdminReportMeta({});
    expect(meta.supportedReports.length).toBeGreaterThan(0);
    expect(meta.presets).toContain("last_30_days");
  });
});

describe("admin report filters", () => {
  it("parses URL filters and preserves validated state", () => {
    const filters = parseAdminReportFilters(
      new URLSearchParams(
        "report=bookings&preset=custom&from=2026-08-01&to=2026-08-10&comparison=previous_period&branchId=br_1",
      ),
    );
    expect(filters.report).toBe("bookings");
    expect(filters.preset).toBe("custom");
    expect(filters.from).toBe("2026-08-01");
    expect(filters.comparison).toBe("previous_period");
    expect(filters.branchId).toBe("br_1");
  });

  it("prunes unsupported filters when switching report domain", () => {
    const pruned = pruneUnsupportedReportFilters({
      report: "customers",
      preset: "last_7_days",
      comparison: "none",
      paymentStatus: "paid",
      staffId: "st_1",
      branchId: "br_1",
    });
    expect(pruned.paymentStatus).toBeUndefined();
    expect(pruned.staffId).toBeUndefined();
    expect(pruned.branchId).toBe("br_1");
  });

  it("builds href and API params without cross-report noise", () => {
    const href = adminReportsHref({
      report: "revenue",
      preset: "last_7_days",
      comparison: "previous_period",
      branchId: "br_1",
    });
    expect(href).toContain("preset=last_7_days");
    expect(href).toContain("branchId=br_1");

    const params = filtersToAdminReportParams({
      report: "revenue",
      preset: "custom",
      from: "2026-08-01",
      to: "2026-08-05",
      comparison: "none",
      staffId: "st_1",
    });
    expect(params.staffId).toBeUndefined();
    expect(params.from).toBe("2026-08-01");
  });

  it("validates custom range and max days", () => {
    expect(
      validateReportRange({
        report: "revenue",
        preset: "custom",
        comparison: "none",
      }).valid,
    ).toBe(false);

    expect(
      validateReportRange(
        {
          report: "revenue",
          preset: "custom",
          from: "2026-01-01",
          to: "2026-08-01",
          comparison: "none",
        },
        30,
      ).valid,
    ).toBe(false);

    expect(
      validateReportRange({
        report: "revenue",
        preset: "last_30_days",
        comparison: "none",
      }).valid,
    ).toBe(true);
  });

  it("counts active filters and permissions", () => {
    const filters = parseAdminReportFilters(
      new URLSearchParams("preset=today&comparison=previous_period"),
    );
    expect(adminReportFiltersApplied(filters)).toBe(true);
    expect(countActiveAdminReportFilters(filters)).toBeGreaterThanOrEqual(2);
    expect(reportPermission("export")).toBe("admin.reports.export");
    expect(reportPermission("revenue")).toBe("admin.reports.revenue.view");
  });

  it("clears report caches", () => {
    const client = new QueryClient();
    client.setQueryData(["admin", "reports", "staff_1", "revenue"], { secret: true });
    clearAdminReportCaches(client, "staff_1");
    expect(client.getQueryData(["admin", "reports", "staff_1", "revenue"])).toBeUndefined();
  });
});
