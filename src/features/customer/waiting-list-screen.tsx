"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  ApiErrorState,
  EmptyState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { WaitingListEntryCard } from "@/features/customer/waiting-list-entry-card";
import { WaitingListSkeleton } from "@/features/customer/waiting-list-skeleton";
import { useSession } from "@/features/auth/session-provider";
import { waitingListEntriesQueryOptions } from "@/lib/api/customer-waiting-list";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { defaultCapabilities, isCapabilityVisible } from "@/config/capabilities";
import { routes } from "@/constants/routes";

function parsePage(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function WaitingListScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = parsePage(searchParams.get("page"));
  const sessionReady = status === "authenticated" && Boolean(user?.id);
  const featureVisible = isCapabilityVisible(defaultCapabilities, "waitingList");

  if (!featureVisible) {
    return (
      <div className="waiting-list-page">
        <PageHeader title="لیست انتظار" />
        <EmptyState
          title="لیست انتظار فعال نیست"
          description="این قابلیت برای مجموعه در حال حاضر غیرفعال است."
          action={
            <Button asChild>
              <Link href={routes.customer.booking}>بازگشت به رزرو</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (status === "loading" || status === "unauthenticated" || status === "expired" || !sessionReady) {
    return (
      <div className="waiting-list-page">
        <PageHeader title="لیست انتظار" description="درخواست‌های لیست انتظار پس از ورود نمایش داده می‌شود." />
        <WaitingListSkeleton />
      </div>
    );
  }

  return <WaitingListScreenReady userId={user!.id} page={page} routerPush={(href) => router.push(href)} />;
}

function WaitingListScreenReady({
  userId,
  page,
  routerPush,
}: {
  userId: string;
  page: number;
  routerPush: (href: string) => void;
}) {
  const query = useQuery(waitingListEntriesQueryOptions(userId, { page }));
  const error = query.isError ? toAppApiError(query.error) : undefined;

  return (
    <div className="waiting-list-page">
      <PageHeader
        title="لیست انتظار"
        description="درخواست لیست انتظار نوبت قطعی ایجاد نمی‌کند و تضمینی برای زمان خالی نیست."
        primaryAction={
          <Button asChild>
            <Link href={routes.customer.waitingListJoin}>پیوستن به لیست انتظار</Link>
          </Button>
        }
        secondaryActions={
          <Button
            variant="secondary"
            leadingIcon={<RefreshCw size={16} aria-hidden="true" />}
            loading={query.isFetching && !query.isPending}
            onClick={() => {
              void query.refetch();
            }}
          >
            به‌روزرسانی
          </Button>
        }
      />
      <span className="visually-hidden" aria-live="polite">
        {query.isPending ? "در حال بارگذاری لیست انتظار." : ""}
        {query.isError ? "بارگذاری لیست انتظار با خطا روبه‌رو شد." : ""}
        {!query.isPending && !query.isError && query.data?.empty
          ? "درخواست لیست انتظاری ندارید."
          : ""}
      </span>

      {query.isPending ? <WaitingListSkeleton /> : null}
      {error ? (
        isForbiddenError(error) ? (
          <PermissionDeniedState description="برای مشاهده لیست انتظار مجوز لازم را ندارید." />
        ) : (
          <ApiErrorState
            title={isNotFoundError(error) ? "لیست انتظار هنوز متصل نیست" : "لیست انتظار بارگذاری نشد"}
            description={
              isNotFoundError(error)
                ? "سرویس لیست انتظار مشتری هنوز در دسترس نیست."
                : error.message
            }
            requestId={error.requestId}
            onRetry={() => {
              void query.refetch();
            }}
          />
        )
      ) : null}

      {!query.isPending && !error && query.data?.empty ? (
        <EmptyState
          title="درخواست فعالی ندارید"
          description="می‌توانید برای سرویس موردنظر به لیست انتظار بپیوندید. این کار نوبت قطعی ایجاد نمی‌کند."
          icon={<ClipboardList size={20} aria-hidden="true" />}
          action={
            <Button asChild>
              <Link href={routes.customer.waitingListJoin}>پیوستن به لیست انتظار</Link>
            </Button>
          }
        />
      ) : null}

      {!query.isPending && !error && query.data && query.data.items.length > 0 ? (
        <>
          <ul className="waiting-list">
            {query.data.items.map((item) => (
              <li key={item.id}>
                <WaitingListEntryCard entry={item} />
              </li>
            ))}
          </ul>
          {query.data.pageCount && query.data.pageCount > 1 ? (
            <Pagination
              page={query.data.page}
              pageCount={query.data.pageCount}
              onPageChange={(next) => {
                const params = new URLSearchParams();
                if (next > 1) params.set("page", String(next));
                const qs = params.toString();
                routerPush(qs ? `${routes.customer.waitingList}?${qs}` : routes.customer.waitingList);
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
