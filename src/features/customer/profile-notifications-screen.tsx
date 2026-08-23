"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/selection";
import {
  ApiErrorState,
  EmptyState,
  SessionExpiredState,
} from "@/components/feedback/app-states";
import { toast } from "@/components/feedback/toast";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileNav } from "@/features/customer/profile-nav";
import { ProfileSkeleton } from "@/features/customer/profile-skeleton";
import { useSession } from "@/features/auth/session-provider";
import {
  notificationPreferencesQueryOptions,
  updateNotificationPreference,
} from "@/lib/api/customer-profile";
import {
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { channelLabel } from "@/lib/customer/profile-adapter";
import { queryKeys } from "@/lib/query/keys";
import { routes, LOGIN_PATH } from "@/constants/routes";
import type { NotificationPreferenceItem } from "@/types/customer-profile";

export function ProfileNotificationsScreen() {
  const queryClient = useQueryClient();
  const { status, user } = useSession();
  const userId = user?.id ?? "anonymous";
  const sessionReady = status === "authenticated" && Boolean(user?.id);
  const pendingIds = useRef(new Set<string>());
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string>();
  const [announce, setAnnounce] = useState("");

  const prefsQuery = useQuery({
    ...notificationPreferencesQueryOptions(userId),
    enabled: sessionReady,
  });

  async function onToggle(item: NotificationPreferenceItem, enabled: boolean) {
    if (item.required || pendingIds.current.has(item.id)) {
      return;
    }
    const previous = prefsQuery.data;
    pendingIds.current.add(item.id);
    setPending((current) => ({ ...current, [item.id]: true }));
    setErrorMessage(undefined);

    if (previous) {
      queryClient.setQueryData(queryKeys.customer.notificationPreferences(userId), {
        ...previous,
        items: previous.items.map((entry) =>
          entry.id === item.id ? { ...entry, enabled } : entry,
        ),
      });
    }

    try {
      const next = await updateNotificationPreference({ id: item.id, enabled });
      queryClient.setQueryData(queryKeys.customer.notificationPreferences(userId), next);
      setAnnounce(enabled ? `${item.label} فعال شد.` : `${item.label} غیرفعال شد.`);
      toast.success("ترجیح اعلان به‌روز شد.");
    } catch (error) {
      if (previous) {
        queryClient.setQueryData(
          queryKeys.customer.notificationPreferences(userId),
          previous,
        );
      }
      const apiError = toAppApiError(error);
      setErrorMessage(apiError.message);
      setAnnounce("به‌روزرسانی ترجیح اعلان ناموفق بود.");
      toast.error("به‌روزرسانی اعلان ناموفق بود.");
    } finally {
      pendingIds.current.delete(item.id);
      setPending((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    }
  }

  if (status === "loading" || status === "unauthenticated" || status === "expired" || !sessionReady) {
    return <ProfileSkeleton label="در حال بارگذاری ترجیحات اعلان" />;
  }

  if (prefsQuery.isPending) {
    return (
      <div className="profile-page">
        <PageHeader title="ترجیحات اعلان" />
        <ProfileNav />
        <ProfileSkeleton label="در حال بارگذاری ترجیحات اعلان" />
      </div>
    );
  }

  if (prefsQuery.isError) {
    const error = toAppApiError(prefsQuery.error);
    if (isSessionExpiredError(error)) {
      return (
        <SessionExpiredState
          description="نشست شما پایان یافته است."
          action={
            <Button asChild>
              <Link href={LOGIN_PATH}>ورود</Link>
            </Button>
          }
        />
      );
    }
    return (
      <div className="profile-page">
        <PageHeader title="ترجیحات اعلان" />
        <ProfileNav />
        <ApiErrorState
          title="بارگذاری ترجیحات اعلان ممکن نشد"
          description={error.message}
          requestId={error.requestId}
          onRetry={() => void prefsQuery.refetch()}
        />
      </div>
    );
  }

  const view = prefsQuery.data;
  const items = view?.items ?? [];

  return (
    <div className="profile-page">
      <PageHeader
        title="ترجیحات اعلان"
        description="اعلان‌های ضروری قابل خاموش‌کردن نیستند."
        breadcrumb={
          <Link href={routes.customer.profile} className="profile-back">
            بازگشت به حساب
          </Link>
        }
      />
      <ProfileNav />
      <span className="visually-hidden" aria-live="polite">
        {announce}
      </span>
      {errorMessage ? (
        <Alert tone="error" title="ذخیره نشد" description={errorMessage} />
      ) : null}
      {view?.disclaimer ? (
        <Alert tone="info" title="توجه" description={view.disclaimer} />
      ) : (
        <Alert
          tone="info"
          title="تحویل اعلان"
          description="تغییر ترجیحات تضمینی برای تحویل پیام نیست و به کانال‌های فعال Backend بستگی دارد."
        />
      )}

      {items.length === 0 ? (
        <EmptyState
          title="ترجیح اعلانی تعریف نشده"
          description="وقتی Backend ترجیحات را ارائه کند، اینجا نمایش داده می‌شوند."
        />
      ) : (
        <ul className="profile-preference-list">
          {items.map((item) => {
            const disabled = item.required || Boolean(pending[item.id]);
            const description = [
              channelLabel(item.channel),
              item.description,
              item.required
                ? "اعلان ضروری — قابل غیرفعال‌سازی نیست."
                : item.disabledReason,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={item.id} className="profile-card">
                <Switch
                  label={item.label}
                  description={description}
                  checked={item.enabled}
                  disabled={disabled}
                  pending={Boolean(pending[item.id])}
                  onCheckedChange={(checked) => void onToggle(item, checked)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
