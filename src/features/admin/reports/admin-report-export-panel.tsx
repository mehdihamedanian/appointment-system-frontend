"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileDown } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/feedback/toast";
import {
  adminReportExportQueryOptions,
  createAdminReportExport,
} from "@/lib/api/admin-reports";
import { toAppApiError, isForbiddenError } from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { reportPermission } from "@/lib/admin/report-filters";
import type { AdminReportExportView, AdminReportListFilters } from "@/types/admin-report";
import type { SessionUser } from "@/types/session";

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AdminReportExportPanel({
  user,
  userId,
  filters,
  exportAllowed,
  blockedReason,
}: {
  user: SessionUser;
  userId: string;
  filters: AdminReportListFilters;
  exportAllowed?: boolean;
  blockedReason?: string;
}) {
  const toast = useToast();
  const statusId = useId();
  const [jobId, setJobId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const canExport =
    exportAllowed === true &&
    (hasPermission(user, reportPermission("export")) || user.permissionCodes.length === 0);

  const exportQuery = useQuery({
    ...adminReportExportQueryOptions(userId, jobId ?? "", filters.report, Boolean(jobId)),
  });

  const exportView: AdminReportExportView | undefined = exportQuery.data;

  async function startExport() {
    setLocalError(null);
    setCreating(true);
    try {
      const result = await createAdminReportExport(filters, newIdempotencyKey());
      setJobId(result.jobId);
      toast.success("درخواست خروجی ثبت شد");
    } catch (error) {
      const appError = toAppApiError(error);
      if (isForbiddenError(appError)) {
        setLocalError("مجوز خروجی گزارش را ندارید.");
      } else {
        setLocalError(appError.message);
      }
    } finally {
      setCreating(false);
    }
  }

  function openDownload(url: string) {
    // Authorized time-limited URL from Backend — open without embedding tokens in app routes.
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (!canExport) {
    return (
      <div className="admin-report-export" role="status">
        <p className="text-caption">
          {blockedReason ?? "خروجی این گزارش در دسترس نیست یا مجوز لازم را ندارید."}
        </p>
      </div>
    );
  }

  return (
    <div className="admin-report-export" aria-labelledby={statusId}>
      <div className="admin-report-export__actions">
        <Button
          variant="secondary"
          leadingIcon={<FileDown size={16} aria-hidden="true" />}
          loading={creating}
          onClick={() => void startExport()}
        >
          خروجی با فیلتر فعلی
        </Button>
      </div>

      {localError ? <Alert tone="error" title="خروجی ناموفق" description={localError} /> : null}

      {exportView ? (
        <div className="admin-report-export__status" id={statusId} role="status">
          <p>
            وضعیت: <strong>{exportView.statusLabel}</strong>
            {exportView.progressLabel ? (
              <>
                {" "}
                — <span>{exportView.progressLabel}</span>
              </>
            ) : null}
          </p>
          {exportView.status === "ready" && exportView.downloadUrl ? (
            <Button
              size="sm"
              leadingIcon={<Download size={16} aria-hidden="true" />}
              onClick={() => openDownload(exportView.downloadUrl!)}
            >
              دانلود
            </Button>
          ) : null}
          {exportView.status === "failed" || exportView.status === "expired" ? (
            <Alert
              tone="error"
              title={exportView.status === "expired" ? "لینک منقضی شده" : "خروجی ناموفق"}
              description={exportView.errorMessage}
            />
          ) : null}
          {exportView.expiresAtLabel && exportView.status === "ready" ? (
            <p className="text-caption">انقضا: {exportView.expiresAtLabel}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
