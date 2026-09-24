"use client";

import { useRef } from "react";
import { FormField } from "@/components/ui/form-field";
import { Textarea, Input } from "@/components/ui/input";
import { estimateSmsLength } from "@/lib/admin/notification-sms";
import type {
  AdminNotificationTemplateContent,
  AdminNotificationTemplateSaveErrors,
} from "@/types/admin-notification";
import type { NotificationChannel } from "@/types/customer-profile";

export function AdminNotificationTemplateEditor({
  channel,
  content,
  errors,
  disabled,
  onChange,
}: {
  channel: NotificationChannel;
  content: AdminNotificationTemplateContent;
  errors: AdminNotificationTemplateSaveErrors;
  disabled?: boolean;
  onChange: (next: AdminNotificationTemplateContent) => void;
}) {
  const smsRef = useRef<HTMLTextAreaElement>(null);
  const emailBodyRef = useRef<HTMLTextAreaElement>(null);
  const plainRef = useRef<HTMLTextAreaElement>(null);

  if (channel === "sms") {
    const smsEstimate = estimateSmsLength(content.smsBody ?? "");
    return (
      <FormField
        id="nt-sms-body"
        label="متن پیامک"
        required
        error={errors.smsBody}
        characterCount={smsEstimate.label}
      >
        <Textarea
          ref={smsRef}
          id="nt-sms-body"
          rows={6}
          value={content.smsBody ?? ""}
          disabled={disabled}
          dir="auto"
          onChange={(event) => onChange({ ...content, smsBody: event.target.value })}
        />
      </FormField>
    );
  }

  return (
    <div className="admin-notification-editor">
      <FormField id="nt-email-subject" label="موضوع" required error={errors.emailSubject}>
        <Input
          id="nt-email-subject"
          value={content.emailSubject ?? ""}
          disabled={disabled}
          dir="auto"
          onChange={(event) => onChange({ ...content, emailSubject: event.target.value })}
        />
      </FormField>
      <FormField id="nt-email-preview" label="متن پیش‌نمایش (اختیاری)" optional error={errors.emailPreviewText}>
        <Input
          id="nt-email-preview"
          value={content.emailPreviewText ?? ""}
          disabled={disabled}
          dir="auto"
          onChange={(event) => onChange({ ...content, emailPreviewText: event.target.value })}
        />
      </FormField>
      <FormField id="nt-email-body" label="متن ایمیل" required error={errors.emailBody ?? errors.form}>
        <Textarea
          ref={emailBodyRef}
          id="nt-email-body"
          rows={8}
          value={content.emailBody ?? ""}
          disabled={disabled}
          dir="auto"
          onChange={(event) => onChange({ ...content, emailBody: event.target.value })}
        />
      </FormField>
      <FormField id="nt-email-plain" label="نسخه متنی ساده (اختیاری)" optional>
        <Textarea
          ref={plainRef}
          id="nt-email-plain"
          rows={5}
          value={content.emailPlainText ?? ""}
          disabled={disabled}
          dir="auto"
          onChange={(event) => onChange({ ...content, emailPlainText: event.target.value })}
        />
      </FormField>
    </div>
  );
}
