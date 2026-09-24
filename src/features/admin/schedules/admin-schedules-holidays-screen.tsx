"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ApiErrorState } from "@/components/feedback/app-states";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Skeleton } from "@/components/feedback/loading-states";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-time";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import { Switch } from "@/components/ui/selection";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import { invalidateAfterAdminScheduleMutation } from "@/lib/admin/schedule-cache";
import { adminScheduleHubHref } from "@/lib/admin/schedule-filters";
import {
  adminScheduleHolidaysQueryOptions,
  createAdminScheduleHoliday,
  deleteAdminScheduleHoliday,
  previewAdminScheduleImpact,
} from "@/lib/api/admin-schedules";
import { isConflictError, toAppApiError } from "@/lib/api/errors";
import { routes } from "@/constants/routes";
import type { AdminScheduleHolidayItem, AdminScheduleImpactPreview } from "@/types/admin-schedule";

export function AdminSchedulesHolidaysScreen() {
  const { status, user } = useSession();
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  if (status === "loading" || !sessionReady) {
    return (
      <>
        <AdminPageHeader title="تعطیلات" description="در حال بارگذاری…" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.schedules.holidays.manage">
      <AdminSchedulesHolidaysReady userId={user!.id} />
    </PermissionGate>
  );
}

function AdminSchedulesHolidaysReady({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery(adminScheduleHolidaysQueryOptions(userId));

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string>();
  const [impactPreview, setImpactPreview] = useState<AdminScheduleImpactPreview | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function createHoliday() {
    if (!name || !date) return;
    setSubmitting(true);
    try {
      let previewVersion: string | undefined;
      try {
        const preview = await previewAdminScheduleImpact("business", undefined, "create_holiday", {
          name,
          date,
          allDay,
          description: description || undefined,
        });
        if (preview.blocked) {
          toast.error(preview.blockedReason ?? "ثبت تعطیلات مجاز نیست.");
          return;
        }
        if (preview.requiresConfirmation) {
          setImpactPreview(preview);
          return;
        }
        previewVersion = preview.previewVersion;
      } catch {
        // preview optional
      }

      await createAdminScheduleHoliday(
        { name, date, allDay, description: description || undefined },
        createIdempotencyKey(),
        previewVersion,
      );
      invalidateAfterAdminScheduleMutation(queryClient, userId, "business", undefined, {
        affectsPublicHours: true,
      });
      await query.refetch();
      setName("");
      setDate("");
      setDescription("");
      toast.success("تعطیلات ثبت شد.");
    } catch (error) {
      toast.error(toAppApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmCreateWithPreview() {
    setSubmitting(true);
    try {
      await createAdminScheduleHoliday(
        { name, date, allDay, description: description || undefined },
        createIdempotencyKey(),
        impactPreview?.previewVersion,
      );
      invalidateAfterAdminScheduleMutation(queryClient, userId, "business", undefined, {
        affectsPublicHours: true,
      });
      await query.refetch();
      setImpactPreview(null);
      setName("");
      setDate("");
      setDescription("");
      toast.success("تعطیلات ثبت شد.");
    } catch (error) {
      toast.error(toAppApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteHoliday(id: string) {
    setDeletingId(id);
    setSubmitting(true);
    try {
      await deleteAdminScheduleHoliday(id, createIdempotencyKey(), impactPreview?.previewVersion);
      invalidateAfterAdminScheduleMutation(queryClient, userId, "business", undefined, {
        affectsPublicHours: true,
      });
      await query.refetch();
      toast.success("تعطیلات حذف شد.");
    } catch (error) {
      const appError = toAppApiError(error);
      if (isConflictError(appError)) {
        await query.refetch();
      }
      toast.error(appError.message);
    } finally {
      setSubmitting(false);
      setDeletingId(undefined);
      setPendingDeleteId(null);
      setImpactPreview(null);
    }
  }

  const holidays = query.data ?? [];

  return (
    <>
      <AdminBreadcrumb pathname={routes.admin.schedules} items={[
          { href: routes.admin.home, label: "پنل مدیریت" },
          { href: adminScheduleHubHref(), label: "زمان‌بندی" },
          { label: "تعطیلات" },
        ]} />
      <AdminPageHeader
        title="تعطیلات"
        description="تعطیلات کسب‌وکار یا شعبه — Backend معنای تمام‌روز/جزئی و تکرار سالانه را تعیین می‌کند."
        secondaryActions={
          <Button asChild variant="secondary">
            <Link href={adminScheduleHubHref()}>بازگشت</Link>
          </Button>
        }
      />

      {query.isError ? (
        <ApiErrorState description={toAppApiError(query.error).message} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <ul className="admin-schedule-list">
            {holidays.length === 0 ? (
              <li className="ds-help">تعطیلاتی ثبت نشده.</li>
            ) : (
              holidays.map((item: AdminScheduleHolidayItem) => (
                <li key={item.id} className="admin-schedule-list__item">
                  <span>{item.name}</span>
                  <span className="ltr-value">{item.date}</span>
                  {item.scopeName ? <span>{item.scopeName}</span> : null}
                  <IconButton
                    size="sm"
                    label={`حذف ${item.name}`}
                    disabled={submitting && deletingId === item.id}
                    onClick={() => setPendingDeleteId(item.id)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </li>
              ))
            )}
          </ul>

          <div className="admin-schedule-form-grid">
            <FormField id="holiday-name" label="نام">
              <Input id="holiday-name" value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField id="holiday-date" label="تاریخ">
              <DatePicker id="holiday-date" value={date || undefined} onChange={(v) => setDate(v ?? "")} />
            </FormField>
            <Switch label="تمام‌روز" checked={allDay} onCheckedChange={setAllDay} />
            <FormField id="holiday-desc" label="توضیح داخلی">
              <Input id="holiday-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </FormField>
            <Button type="button" loading={submitting} disabled={!name || !date} onClick={() => void createHoliday()}>
              افزودن تعطیلات
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(impactPreview && !pendingDeleteId)}
        title={impactPreview?.title ?? "تأیید تعطیلات"}
        description={impactPreview?.summary ?? "تعطیلات ثبت شود؟"}
        confirmLabel="ثبت"
        variant="primary"
        busy={submitting}
        onCancel={() => setImpactPreview(null)}
        onConfirm={() => void confirmCreateWithPreview()}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="حذف تعطیلات"
        description="این تعطیلات حذف شود؟ Backend ممکن است نوبت‌های تحت تأثیر را گزارش کند."
        confirmLabel="حذف"
        busy={submitting}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => pendingDeleteId && void deleteHoliday(pendingDeleteId)}
      />
    </>
  );
}
