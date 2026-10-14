import { describe, expect, it } from "vitest";
import { adaptAdminActivityLogExportJob } from "@/lib/admin/activity-log-adapter";
import { adaptAdminBranchDetail } from "@/lib/admin/branch-adapter";
import { adaptAdminReportExport, adaptAdminReportView } from "@/lib/admin/report-adapter";
import { readUrl } from "@/lib/public/read";

const SCRIPT_URLS = [
  "javascript:alert(1)",
  " JavaScript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
];
const OFF_SITE_RELATIVE = ["//evil.example/x", "/\\evil.example/x", "/\t/evil.example", "/\n/evil.example"];

describe("readUrl", () => {
  it("keeps http(s) and same-site paths", () => {
    expect(readUrl("https://files.example/r.csv")).toBe("https://files.example/r.csv");
    expect(readUrl("/admin/reports?x=1")).toBe("/admin/reports?x=1");
  });

  it.each([...SCRIPT_URLS, ...OFF_SITE_RELATIVE])("rejects %j", (value) => {
    expect(readUrl(value)).toBeUndefined();
  });
});

describe("Backend-supplied links never carry script or off-site paths", () => {
  it.each(SCRIPT_URLS)("activity-log export download %j", (url) => {
    const job = adaptAdminActivityLogExportJob({ jobId: "EXP-1", status: "ready", downloadUrl: url });
    expect(job.downloadUrl).toBeUndefined();
  });

  it.each(SCRIPT_URLS)("report export download %j", (url) => {
    const view = adaptAdminReportExport({ jobId: "EXP-1", status: "ready", downloadUrl: url }, "revenue");
    expect(view?.downloadUrl).toBeUndefined();
  });

  it.each(OFF_SITE_RELATIVE)("report breakdown row %j", (href) => {
    const view = adaptAdminReportView(
      { breakdown: [{ id: "r1", label: "شعبه", href, metrics: [] }] },
      "revenue",
    );
    expect(view.breakdown).toHaveLength(1);
    expect(view.breakdown[0]?.href).toBeUndefined();
  });

  it.each(SCRIPT_URLS)("branch map and directions %j", (url) => {
    const detail = adaptAdminBranchDetail({
      id: "br_1",
      reference: "BR-1",
      name: "شعبه شمال",
      status: "active",
      location: { mapUrl: url, directionsUrl: url, label: "نقشه" },
    });
    expect(detail?.location?.mapUrl).toBeUndefined();
    expect(detail?.location?.directionsUrl).toBeUndefined();
  });

  it("keeps a valid download link", () => {
    const job = adaptAdminActivityLogExportJob({
      jobId: "EXP-1",
      status: "ready",
      downloadUrl: "https://files.example/logs.csv",
    });
    expect(job.downloadUrl).toBe("https://files.example/logs.csv");
  });
});
