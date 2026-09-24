"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/feedback/toast";
import {
  submitAdminCheckIn,
  submitAdminComplete,
  submitAdminConfirm,
  submitAdminNoShow,
  submitAdminStart,
} from "@/lib/api/admin-appointments";
import {
  adminConflictMessage,
  isAdminAppointmentConflict,
} from "@/lib/admin/appointment-adapter";
import { invalidateAfterAdminAppointmentMutation } from "@/lib/admin/appointment-cache";
import {
  adminActionFingerprint,
  adminActionIdempotencyKey,
} from "@/lib/admin/appointment-idempotency";
import { toAppApiError } from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import { ADMIN_APPOINTMENT_RESCHEDULE_ENABLED } from "@/types/admin-appointment";
import type {
  AdminAppointmentActionKey,
  AdminAppointmentDetailView,
} from "@/types/admin-appointment";
import type { SessionUser } from "@/types/session";

const ACTION_LABELS: Record<AdminAppointmentActionKey, string> = {
  confirm: "تأیید نوبت",
  checkIn: "ثبت ورود",
  start: "شروع",
  complete: "اتمام",
  markNoShow: "حاضر نشد",
  cancel: "لغو",
  reschedule: "تغییر زمان",
  editInternalNote: "یادداشت داخلی",
};

export function AdminAppointmentActions({
  view,
  user,
  userId,
  onRefresh,
}: {
  view: AdminAppointmentDetailView;
  user: SessionUser;
  userId: string;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const [pendingAction, setPendingAction] = useState<AdminAppointmentActionKey | null>(null);
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const actions = view.allowedActions;
  const busy = submitting || actions.processing === true;

  async function runAction(action: AdminAppointmentActionKey) {
    if (busy) return;
    setSubmitting(true);
    setConflictMessage(null);
    setPendingAction(action);
    const fingerprint = adminActionFingerprint({
      reference: view.reference,
      action,
      version: view.version,
    });
    const key = adminActionIdempotencyKey(idempotencyRef, fingerprint);
    const versionBody = { version: view.version };

    try {
      if (action === "confirm") {
        await submitAdminConfirm(view.reference, versionBody, key);
      } else if (action === "checkIn") {
        await submitAdminCheckIn(view.reference, versionBody, key);
      } else if (action === "start") {
        await submitAdminStart(view.reference, versionBody, key);
      } else if (action === "complete") {
        await submitAdminComplete(view.reference, versionBody, key);
      } else if (action === "markNoShow") {
        await submitAdminNoShow(view.reference, versionBody, key);
      }
      invalidateAfterAdminAppointmentMutation(queryClient, userId, view.reference, action);
      toast.success("عملیات با موفقیت انجام شد.");
      idempotencyRef.current = undefined;
      onRefresh();
    } catch (error) {
      const normalized = toAppApiError(error);
      if (isAdminAppointmentConflict(normalized)) {
        setConflictMessage(adminConflictMessage());
        onRefresh();
      } else {
        toast.error(normalized.message);
      }
    } finally {
      setSubmitting(false);
      setPendingAction(null);
      setConfirmNoShow(false);
    }
  }

  const canReschedule =
    actions.reschedule === true &&
    ADMIN_APPOINTMENT_RESCHEDULE_ENABLED &&
    hasPermission(user, "admin.appointments.view");

  const visibleActions = (
    ["confirm", "checkIn", "start", "complete", "markNoShow", "cancel"] as const
  ).filter((key) => actions[key] === true);

  if (visibleActions.length === 0 && !canReschedule) {
    return actions.blockedReason ? (
      <Alert tone="info" title="اقدامی در دسترس نیست" description={actions.blockedReason} />
    ) : null;
  }

  return (
    <section className="admin-appointment-actions" aria-labelledby="admin-appointment-actions-title">
      <h2 id="admin-appointment-actions-title" className="text-card-title">
        اقدامات
      </h2>
      {conflictMessage ? (
        <Alert tone="warning" title="نوبت تغییر کرد" description={conflictMessage} />
      ) : null}
      <div className="admin-appointment-actions__buttons">
        {actions.confirm ? (
          <Button
            loading={pendingAction === "confirm"}
            disabled={busy && pendingAction !== "confirm"}
            onClick={() => void runAction("confirm")}
          >
            {ACTION_LABELS.confirm}
          </Button>
        ) : null}
        {actions.checkIn ? (
          <Button
            variant="secondary"
            loading={pendingAction === "checkIn"}
            disabled={busy && pendingAction !== "checkIn"}
            onClick={() => void runAction("checkIn")}
          >
            {ACTION_LABELS.checkIn}
          </Button>
        ) : null}
        {actions.start ? (
          <Button
            variant="secondary"
            loading={pendingAction === "start"}
            disabled={busy && pendingAction !== "start"}
            onClick={() => void runAction("start")}
          >
            {ACTION_LABELS.start}
          </Button>
        ) : null}
        {actions.complete ? (
          <Button
            variant="secondary"
            loading={pendingAction === "complete"}
            disabled={busy && pendingAction !== "complete"}
            onClick={() => void runAction("complete")}
          >
            {ACTION_LABELS.complete}
          </Button>
        ) : null}
        {actions.markNoShow ? (
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => setConfirmNoShow(true)}
          >
            {ACTION_LABELS.markNoShow}
          </Button>
        ) : null}
        {actions.cancel ? (
          <Button variant="outline" asChild disabled={busy}>
            <Link href={routes.admin.appointmentCancel(view.id)}>{ACTION_LABELS.cancel}</Link>
          </Button>
        ) : null}
        {canReschedule ? (
          <Button variant="outline" asChild disabled={busy}>
            <Link href={routes.admin.appointmentReschedule(view.id)}>{ACTION_LABELS.reschedule}</Link>
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmNoShow}
        title="ثبت «حاضر نشد»"
        description={`آیا از ثبت «حاضر نشد» برای ${view.customer.name} در این نوبت مطمئن هستید؟ این اقدام ممکن است پیامدهای عملیاتی داشته باشد.`}
        confirmLabel="ثبت حاضر نشد"
        busy={submitting}
        onCancel={() => setConfirmNoShow(false)}
        onConfirm={() => void runAction("markNoShow")}
      />
    </section>
  );
}
