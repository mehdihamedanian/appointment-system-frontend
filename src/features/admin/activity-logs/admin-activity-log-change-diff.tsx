"use client";

import type { AdminActivityLogFieldChange } from "@/types/admin-activity-log";

export function AdminActivityLogChangeDiff({
  changes,
}: {
  changes: AdminActivityLogFieldChange[];
}) {
  if (changes.length === 0) {
    return <p className="ds-help">تغییر فیلدی گزارش نشده است.</p>;
  }

  return (
    <div className="admin-activity-log-diff" role="table" aria-label="مقایسه مقادیر قبل و بعد">
      <div className="admin-activity-log-diff__head" role="row">
        <span role="columnheader">فیلد</span>
        <span role="columnheader">نوع تغییر</span>
        <span role="columnheader">قبل</span>
        <span role="columnheader">بعد</span>
      </div>
      {changes.map((change) => (
        <div
          key={change.fieldKey}
          className="admin-activity-log-diff__row"
          role="row"
          data-kind={change.kind}
        >
          <span role="cell" className="admin-activity-log-diff__field">
            {change.fieldLabel}
            {change.hidden ? (
              <span className="text-caption"> (پنهان‌شده)</span>
            ) : null}
          </span>
          <span role="cell">
            <span className="admin-activity-log-diff__kind" data-kind={change.kind}>
              {change.kindLabel}
            </span>
          </span>
          <span role="cell" className="admin-activity-log-diff__value ltr-value">
            {change.previousDisplay}
          </span>
          <span role="cell" className="admin-activity-log-diff__value ltr-value">
            {change.nextDisplay}
          </span>
        </div>
      ))}
    </div>
  );
}
