"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { FormError, Label } from "@/components/ui/form-field";
import { useToast } from "@/components/feedback/toast";
import { submitAdminInternalNote } from "@/lib/api/admin-appointments";
import {
  adminConflictMessage,
  isAdminAppointmentConflict,
} from "@/lib/admin/appointment-adapter";
import { invalidateAfterAdminInternalNote } from "@/lib/admin/appointment-cache";
import {
  internalNoteFingerprint,
  internalNoteIdempotencyKey,
} from "@/lib/admin/appointment-idempotency";
import { toAppApiError } from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { ADMIN_INTERNAL_NOTE_MAX_LENGTH } from "@/types/admin-appointment";
import type { AdminAppointmentDetailView } from "@/types/admin-appointment";
import type { SessionUser } from "@/types/session";

export function AdminAppointmentInternalNote({
  view,
  user,
  userId,
  onSaved,
}: {
  view: AdminAppointmentDetailView;
  user: SessionUser;
  userId: string;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const [note, setNote] = useState(view.internalNote ?? "");
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [syncedKey, setSyncedKey] = useState(`${view.updatedAt ?? ""}:${view.internalNote ?? ""}`);
  const syncKey = `${view.updatedAt ?? ""}:${view.internalNote ?? ""}`;
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey);
    setNote(view.internalNote ?? "");
    setDirty(false);
  }

  const canEdit =
    view.allowedActions.editInternalNote === true &&
    (hasPermission(user, "admin.appointments.edit_internal_note") ||
      user.permissionCodes.length === 0);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  if (!canEdit && !view.internalNote) {
    return null;
  }

  async function onSave() {
    const trimmed = note.trim();
    if (trimmed.length > ADMIN_INTERNAL_NOTE_MAX_LENGTH) {
      setFieldError(`حداکثر ${ADMIN_INTERNAL_NOTE_MAX_LENGTH} کاراکتر مجاز است.`);
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    setFieldError(null);
    setConflictMessage(null);
    const fingerprint = internalNoteFingerprint({
      reference: view.reference,
      note: trimmed,
      version: view.version,
    });
    const key = internalNoteIdempotencyKey(idempotencyRef, fingerprint);
    try {
      await submitAdminInternalNote(
        view.reference,
        { note: trimmed, version: view.version },
        key,
      );
      invalidateAfterAdminInternalNote(queryClient, userId, view.reference);
      toast.success("یادداشت داخلی ذخیره شد.");
      idempotencyRef.current = undefined;
      setDirty(false);
      onSaved();
    } catch (error) {
      const normalized = toAppApiError(error);
      if (isAdminAppointmentConflict(normalized)) {
        setConflictMessage(adminConflictMessage());
        onSaved();
      } else {
        toast.error(normalized.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="admin-appointment-internal-note"
      aria-labelledby="admin-internal-note-title"
    >
      <h2 id="admin-internal-note-title" className="text-card-title">
        یادداشت داخلی
      </h2>
      <Alert
        tone="warning"
        title="فقط برای تیم داخلی"
        description="این یادداشت برای مشتری، اعلان‌ها و صفحات عمومی نمایش داده نمی‌شود."
      />
      {conflictMessage ? (
        <Alert tone="warning" title="نوبت تغییر کرد" description={conflictMessage} />
      ) : null}
      {canEdit ? (
        <>
          <Label htmlFor="admin-internal-note">متن یادداشت</Label>
          <Textarea
            id="admin-internal-note"
            value={note}
            maxLength={ADMIN_INTERNAL_NOTE_MAX_LENGTH}
            rows={4}
            onChange={(event) => {
              setNote(event.target.value);
              setDirty(true);
              setFieldError(null);
            }}
          />
          {fieldError ? <FormError>{fieldError}</FormError> : null}
          <Button loading={submitting} disabled={!dirty || submitting} onClick={() => void onSave()}>
            ذخیره یادداشت داخلی
          </Button>
        </>
      ) : view.internalNote ? (
        <p className="admin-appointment-internal-note__readonly">{view.internalNote}</p>
      ) : null}
    </section>
  );
}
