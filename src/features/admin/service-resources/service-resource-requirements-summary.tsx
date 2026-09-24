"use client";

import type { AdminServiceResourceRequirementItem } from "@/types/admin-service-resource-requirement";

export function ServiceResourceRequirementsSummary({
  lines,
  duplicateWarnings,
  title = "خلاصه نیازمندی‌ها",
}: {
  lines: string[];
  duplicateWarnings?: string[];
  title?: string;
}) {
  if (!lines.length && !(duplicateWarnings?.length ?? 0)) {
    return (
      <section className="admin-service-requirements-summary" aria-labelledby="req-summary-title">
        <h3 id="req-summary-title" className="text-card-title">
          {title}
        </h3>
        <p className="ds-help">هنوز نیازمندی منبعی تعریف نشده است.</p>
      </section>
    );
  }

  return (
    <section className="admin-service-requirements-summary" aria-labelledby="req-summary-title">
      <h3 id="req-summary-title" className="text-card-title">
        {title}
      </h3>
      {lines.length > 0 ? (
        <ul className="admin-service-requirements-summary__list">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {duplicateWarnings?.map((warning) => (
        <p key={warning} className="ds-help" role="status">
          {warning}
        </p>
      ))}
      <p className="ds-help">این خلاصه فقط در پنل مدیریت نمایش داده می‌شود و به مشتری نشان داده نمی‌شود.</p>
    </section>
  );
}

export function previewSummaryFromItems(items: AdminServiceResourceRequirementItem[]): string[] {
  return items.map((item) => item.summaryLine ?? "").filter(Boolean);
}
