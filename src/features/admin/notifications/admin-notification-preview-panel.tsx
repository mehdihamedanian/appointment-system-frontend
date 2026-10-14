"use client";

import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/data-display";
import { asSafeText } from "@/lib/public/read";
import type { AdminNotificationPreviewResult } from "@/types/admin-notification";
import type { NotificationChannel } from "@/types/customer-profile";

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

function SafeHtmlPreview({ html, direction }: { html: string; direction?: string }) {
  const safe = (asSafeText(html) ?? "").replace(/[&<>"]/g, (char) => HTML_ESCAPES[char] ?? char);
  const dir = direction === "ltr" || direction === "auto" ? direction : "rtl";
  return (
    <iframe
      title="پیش‌نمایش ایمیل"
      className="admin-notification-preview__iframe"
      sandbox=""
      srcDoc={`<!DOCTYPE html><html dir="${dir}"><body style="font-family:sans-serif;padding:16px;margin:0;">${safe.replace(/\n/g, "<br>")}</body></html>`}
    />
  );
}

export function AdminNotificationPreviewPanel({
  channel,
  preview,
  loading,
  error,
}: {
  channel: NotificationChannel;
  preview?: AdminNotificationPreviewResult | null;
  loading?: boolean;
  error?: string;
}) {
  return (
    <Card title="پیش‌نمایش امن">
      <p className="ds-help">
        پیش‌نمایش با داده نمونه است و تضمین ارسال موفق نیست. اطلاعات واقعی مشتری نمایش داده نمی‌شود.
      </p>
      {loading ? <p aria-live="polite">در حال بارگذاری پیش‌نمایش…</p> : null}
      {error ? <Alert tone="error" title="پیش‌نمایش" description={error} /> : null}
      {preview?.warnings.length ? (
        <Alert tone="warning" title="هشدار" description={preview.warnings.join(" ")} />
      ) : null}
      {preview?.invalidVariables.length ? (
        <Alert
          tone="warning"
          title="متغیر نامعتبر"
          description={`متغیرهای پشتیبانی‌نشده: ${preview.invalidVariables.join(", ")}`}
        />
      ) : null}

      {preview && channel === "sms" && preview.smsBody ? (
        <div
          className="admin-notification-preview__sms"
          dir={preview.direction ?? "rtl"}
          aria-label="پیش‌نمایش پیامک"
        >
          {preview.smsBody}
        </div>
      ) : null}

      {preview && channel === "email" ? (
        <div className="admin-notification-preview__email" dir={preview.direction ?? "rtl"}>
          {preview.emailSubject ? (
            <p>
              <strong>موضوع:</strong> {preview.emailSubject}
            </p>
          ) : null}
          {preview.emailPreviewText ? (
            <p className="text-caption">{preview.emailPreviewText}</p>
          ) : null}
          {preview.emailBodyHtml ? (
            <SafeHtmlPreview html={preview.emailBodyHtml} direction={preview.direction} />
          ) : preview.emailBodyPlain ? (
            <pre className="admin-notification-preview__plain">{preview.emailBodyPlain}</pre>
          ) : null}
        </div>
      ) : null}

      {preview?.segmentCountLabel || preview?.characterCountLabel ? (
        <p className="text-caption ltr-value">
          {[preview.characterCountLabel, preview.segmentCountLabel].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </Card>
  );
}
