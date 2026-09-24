"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/feedback/toast";
import { appendAdminCustomerNote } from "@/lib/api/admin-customers";
import { invalidateAfterAdminCustomerNoteMutation } from "@/lib/admin/customer-cache";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import { toAppApiError } from "@/lib/api/errors";
import type { AdminCustomerDetailView, AdminCustomerNoteView } from "@/types/admin-customer";

export function AdminCustomerNotesPanel({
  userId,
  view,
  notes,
  onRefetch,
}: {
  userId: string;
  view: AdminCustomerDetailView;
  notes: AdminCustomerNoteView[];
  onRefetch: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const submitLock = useRef(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const canManage = view.allowedActions.manageNotes !== false;

  async function submitNote() {
    if (!canManage || submitLock.current || !body.trim()) return;
    submitLock.current = true;
    setSubmitting(true);
    setError(undefined);
    try {
      await appendAdminCustomerNote(
        view.reference,
        { body: body.trim(), version: view.version },
        createIdempotencyKey(),
      );
      invalidateAfterAdminCustomerNoteMutation(queryClient, userId, view.reference);
      toast.success("یادداشت ثبت شد.");
      setBody("");
      onRefetch();
    } catch (err) {
      setError(toAppApiError(err).message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="admin-customer-notes" aria-labelledby="customer-notes-title">
      <h3 id="customer-notes-title" className="text-card-title">
        یادداشت‌های داخلی
      </h3>
      <Alert
        tone="info"
        title="فقط داخلی"
        description="این یادداشت‌ها برای مشتری، اعلان‌ها یا پروفایل عمومی قابل مشاهده نیستند."
      />

      {notes.length === 0 ? (
        <p className="ds-help">یادداشت داخلی ثبت نشده است.</p>
      ) : (
        <ul className="admin-customer-notes-list">
          {notes.map((note) => (
            <li key={note.id}>
              <article className="admin-customer-note ds-card">
                <p>{note.body}</p>
                {note.authorLabel || note.createdAtLabel ? (
                  <footer className="text-caption">
                    {[note.authorLabel, note.createdAtLabel].filter(Boolean).join(" · ")}
                  </footer>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      )}

      {canManage && view.capabilities.supportsNotesAppend !== false ? (
        <form
          className="admin-customer-note-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitNote();
          }}
        >
          {error ? <Alert tone="error" title="خطا" description={error} /> : null}
          <FormField id="customer-note-body" label="یادداشت جدید">
            <Textarea
              id="customer-note-body"
              value={body}
              disabled={submitting}
              onChange={(event) => setBody(event.target.value)}
            />
          </FormField>
          <Button type="submit" loading={submitting} disabled={!body.trim()}>
            افزودن یادداشت
          </Button>
        </form>
      ) : null}
    </section>
  );
}
