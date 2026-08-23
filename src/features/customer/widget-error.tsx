import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function WidgetError({
  title,
  description = "این بخش فعلاً در دسترس نیست. بقیه داشبورد قابل استفاده است.",
  requestId,
  onRetry,
}: {
  title: string;
  description?: string;
  requestId?: string;
  onRetry: () => void;
}) {
  return (
    <Alert
      tone="error"
      title={title}
      description={description}
      action={
        <div className="ds-stack" style={{ gap: "var(--space-2)" }}>
          {requestId ? (
            <p className="text-caption">
              شناسه درخواست: <span className="ltr-value">{requestId}</span>
            </p>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onRetry}>
            تلاش دوباره
          </Button>
        </div>
      }
    />
  );
}
