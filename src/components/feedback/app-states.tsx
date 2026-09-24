import type { ReactNode } from "react";
import {
  Ban,
  CalendarOff,
  CircleCheck,
  Inbox,
  Lock,
  PackageX,
  RefreshCw,
  SearchX,
  ShieldOff,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type StateTone = "default" | "danger" | "warning" | "success";

function StateCard({
  title,
  description,
  icon,
  tone = "default",
  action,
  role,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  tone?: StateTone;
  action?: ReactNode;
  role?: "status" | "alert";
}) {
  return (
    <section
      className={`state-card state-card--${tone}`}
      aria-labelledby="feedback-state-title"
      role={role}
    >
      <div className="state-card__icon" aria-hidden="true">
        {icon}
      </div>
      <h2 id="feedback-state-title">{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function EmptyState({
  title = "موردی برای نمایش نیست",
  description = "وقتی داده‌ای ثبت شود، اینجا نمایش داده می‌شود.",
  action,
  secondaryAction,
  icon,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <StateCard
      title={title}
      description={description}
      icon={icon ?? <Inbox size={20} />}
      action={
        action || secondaryAction ? (
          <div className="ds-inline">
            {action}
            {secondaryAction}
          </div>
        ) : null
      }
    />
  );
}

export function NoResultsState({
  title = "نتیجه‌ای پیدا نشد",
  description = "عبارت یا فیلتر دیگری را امتحان کنید.",
  action,
  secondaryAction,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <StateCard
      title={title}
      description={description}
      icon={<SearchX size={20} />}
      action={
        action || secondaryAction ? (
          <div className="ds-inline">
            {action}
            {secondaryAction}
          </div>
        ) : null
      }
    />
  );
}

export function ApiErrorState({
  title = "دریافت اطلاعات ممکن نشد",
  description = "لطفاً اتصال خود را بررسی کنید و دوباره تلاش کنید.",
  onRetry,
  requestId,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  requestId?: string;
}) {
  return (
    <StateCard
      tone="danger"
      role="alert"
      title={title}
      description={description}
      icon={<WifiOff size={20} />}
      action={
        <>
          {requestId ? (
            <p className="text-caption">
              شناسه درخواست: <span className="ltr-value">{requestId}</span>
            </p>
          ) : null}
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

export function PermissionDeniedState({
  title = "دسترسی مجاز نیست",
  description = "برای مشاهده این بخش مجوز لازم را ندارید. از حساب خود خارج نمی‌شوید.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <StateCard
      tone="warning"
      role="status"
      title={title}
      description={description}
      icon={<ShieldOff size={20} />}
      action={action}
    />
  );
}

export function FeatureDisabledState({
  title = "این قابلیت فعال نیست",
  description = "این بخش برای کسب‌وکار شما در حال حاضر در دسترس نیست.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <StateCard
      tone="default"
      role="status"
      title={title}
      description={description}
      icon={<Ban size={20} />}
      action={action}
    />
  );
}

export function BackendDependencyState({
  title = "اتصال به سرویس آماده نیست",
  description = "قرارداد یا نقطهٔ دسترسی Backend برای این بخش هنوز در دسترس نیست. این حالت به‌معنای خالی بودن داده نیست.",
  action,
  requestId,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  requestId?: string;
}) {
  return (
    <StateCard
      tone="warning"
      role="status"
      title={title}
      description={description}
      icon={<PackageX size={20} />}
      action={
        <>
          {requestId ? (
            <p className="text-caption">
              شناسه درخواست: <span className="ltr-value">{requestId}</span>
            </p>
          ) : null}
          {action}
        </>
      }
    />
  );
}

export function ConflictState({
  title = "وضعیت تغییر کرده است",
  description = "اطلاعات به‌روز شده است. لطفاً وضعیت جدید را بررسی کنید و در صورت نیاز دوباره اقدام کنید.",
  onRefresh,
  action,
}: {
  title?: string;
  description?: string;
  onRefresh?: () => void;
  action?: ReactNode;
}) {
  return (
    <StateCard
      tone="warning"
      role="alert"
      title={title}
      description={description}
      icon={<RefreshCw size={20} />}
      action={
        action || onRefresh ? (
          <div className="ds-inline">
            {onRefresh ? (
              <Button variant="secondary" onClick={onRefresh}>
                بارگذاری مجدد
              </Button>
            ) : null}
            {action}
          </div>
        ) : null
      }
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
      role="alert"
      title={title}
      description={description}
      icon={<CalendarOff size={20} />}
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
  const showDetail = process.env.NODE_ENV === "development" && Boolean(detail);

  return (
    <StateCard
      tone="danger"
      role="alert"
      title={title}
      description={description}
      icon={<TriangleAlert size={20} />}
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
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <StateCard
      tone="success"
      role="status"
      title={title}
      description={description}
      icon={<CircleCheck size={20} />}
      action={action}
    />
  );
}

export function NotFoundState({
  title = "صفحه یا مورد پیدا نشد",
  description = "آدرس ممکن است اشتباه باشد یا مورد حذف شده باشد.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <StateCard
      tone="default"
      role="status"
      title={title}
      description={description}
      icon={<Lock size={20} />}
      action={action}
    />
  );
}

export const ErrorState = ApiErrorState;
