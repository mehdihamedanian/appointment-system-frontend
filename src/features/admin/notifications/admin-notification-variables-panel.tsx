"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/data-display";
import type { AdminNotificationTemplateVariable } from "@/types/admin-notification";

export function AdminNotificationVariablesPanel({
  variables,
  onInsert,
  disabled,
}: {
  variables: AdminNotificationTemplateVariable[];
  onInsert: (token: string) => void;
  disabled?: boolean;
}) {
  if (!variables.length) {
    return (
      <Card title="متغیرهای مجاز">
        <p className="ds-help">Backend متغیر مجازی برای این رویداد/کانال برنگرداند.</p>
      </Card>
    );
  }

  return (
    <Card title="متغیرهای مجاز">
      <ul className="admin-notification-variables">
        {variables.map((variable) => (
          <li key={variable.token} className="admin-notification-variables__item">
            <div className="admin-notification-variables__head">
              <strong>{variable.label}</strong>
              <code className="ltr-value admin-notification-token">{`{{${variable.token}}}`}</code>
            </div>
            {variable.description ? <p>{variable.description}</p> : null}
            {variable.sampleValue ? (
              <p className="text-caption">
                نمونه: <span className="ltr-value">{variable.sampleValue}</span>
              </p>
            ) : null}
            <div className="admin-notification-variables__meta">
              {variable.required ? <span className="admin-notification-variables__required">الزامی</span> : null}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={disabled}
                onClick={() => onInsert(variable.token)}
              >
                درج در متن
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
