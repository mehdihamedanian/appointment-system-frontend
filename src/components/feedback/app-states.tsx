import { CalendarOff, Inbox, SearchX, ShieldOff, TriangleAlert, WifiOff, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

type StateTone = "default" | "danger" | "warning" | "success";

function StateCard({
  title,
  description,
  icon,
  tone = "default",
  action,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  tone?: StateTone;
  action?: ReactNode;
}) {
  return (
    <section
      className={`state-card state-card--${tone}`}
      aria-labelledby="feedback-state-title"
    >
      <div className="state-card__icon">{icon}</div>
      <h2 id="feedback-state-title">{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function EmptyState({
  title = "موردی برای نمایش نیست",
  description = "وقتی داده‌ای ثبت شود، اینجا نمایش داده می‌شود.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <StateCard
      title={title}
      description={description}
      icon={<Inbox size={20} aria-hidden="true" />}
    />
  );
}

export function NoResultsState({
  title = "نتیجه‌ای پیدا نشد",
  description = "عبارت یا فیلتر دیگری را امتحان کنید.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <StateCard
      title={title}
      description={description}
      icon={<SearchX size={20} aria-hidden="true" />}
    />
  );
}

export function ApiErrorState({
  title = "دریافت اطلاعات ممکن نشد",
  description = "لطفاً اتصال خود را بررسی کنید و دوباره تلاش کنید.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <StateCard
      tone="danger"
      title={title}
      description={description}
      icon={<WifiOff size={20} aria-hidden="true" />}
      action={
        onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            تلاش دوباره
          </Button>
        ) : null
      }
    />
  );
}

export function PermissionDeniedState({
  title = "دسترسی مجاز نیست",
  description = "برای مشاهده این بخش مجوز لازم را ندارید.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <StateCard
      tone="warning"
      title={title}
      description={description}
      icon={<ShieldOff size={20} aria-hidden="true" />}
    />
  );
}

export function SessionExpiredState({
  title = "نشست شما پایان یافته است",
  description = "برای ادامه، دوباره وارد حساب خود شوید.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <StateCard
      tone="warning"
      title={title}
      description={description}
      icon={<CalendarOff size={20} aria-hidden="true" />}
      action={action}
    />
  );
}

export function UnexpectedErrorState({
  title = "اختلالی رخ داد",
  description = "لطفاً صفحه را تازه‌سازی کنید یا کمی بعد دوباره تلاش کنید.",
  onRetry,
  detail,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  detail?: string;
}) {
  const showDetail =
    process.env.NODE_ENV === "development" && Boolean(detail);

  return (
    <StateCard
      tone="danger"
      title={title}
      description={description}
      icon={<TriangleAlert size={20} aria-hidden="true" />}
      action={
        <>
          {showDetail ? <p className="ltr-value">{detail}</p> : null}
          {onRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              تلاش دوباره
            </Button>
          ) : null}
        </>
      }
    />
  );
}

export function SuccessState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <StateCard
      tone="success"
      title={title}
      description={description}
      icon={<CircleCheck size={20} aria-hidden="true" />}
    />
  );
}
