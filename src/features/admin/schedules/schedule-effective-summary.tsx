import type { AdminScheduleEffectiveSummary, AdminScheduleView } from "@/types/admin-schedule";
import { ADMIN_SCHEDULE_INHERITANCE_LABELS } from "@/types/admin-schedule";

export function ScheduleEffectiveSummary({
  effective,
  overrideSemanticsLabel,
}: {
  effective: AdminScheduleEffectiveSummary;
  overrideSemanticsLabel?: string;
}) {
  const inheritanceLabel =
    effective.inheritanceLabel ??
    (effective.inheritanceMode !== "unknown"
      ? ADMIN_SCHEDULE_INHERITANCE_LABELS[effective.inheritanceMode]
      : undefined);

  return (
    <section className="admin-schedule-effective" aria-labelledby="schedule-effective-title">
      <h3 id="schedule-effective-title" className="text-card-title">
        برنامه مؤثر (Backend)
      </h3>
      {effective.sourceLabel ? <p>منبع: {effective.sourceLabel}</p> : null}
      {inheritanceLabel ? <p>حالت وراثت: {inheritanceLabel}</p> : null}
      {overrideSemanticsLabel ? (
        <p className="ds-help">رفتار روز ویژه/جایگزینی: {overrideSemanticsLabel}</p>
      ) : null}
      {effective.weeklySummary?.length ? (
        <ul>
          {effective.weeklySummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {effective.activeSpecialDays?.length ? (
        <div>
          <p className="text-card-title">روزهای ویژه فعال</p>
          <ul>
            {effective.activeSpecialDays.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {effective.activeOverrides?.length ? (
        <div>
          <p className="text-card-title">جایگزینی‌های فعال</p>
          <ul>
            {effective.activeOverrides.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {effective.timeOffSummary?.length ? (
        <div>
          <p className="text-card-title">مرخصی</p>
          <ul>
            {effective.timeOffSummary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {effective.blockSummary?.length ? (
        <div>
          <p className="text-card-title">زمان مسدود</p>
          <ul>
            {effective.blockSummary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {effective.lastUpdatedAt ? (
        <p className="ds-help ltr-value">آخرین به‌روزرسانی: {effective.lastUpdatedAt}</p>
      ) : null}
    </section>
  );
}

export function scheduleEditorTitle(view: AdminScheduleView): string {
  const scopeLabel = view.scopeName ?? view.scopeReference ?? view.scope;
  return `زمان‌بندی ${scopeLabel}`;
}
