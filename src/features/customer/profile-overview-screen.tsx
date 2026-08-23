"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import {
  ApiErrorState,
  SessionExpiredState,
} from "@/components/feedback/app-states";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileAvatar } from "@/features/customer/profile-avatar";
import { ProfileNav } from "@/features/customer/profile-nav";
import { ProfileSkeleton } from "@/features/customer/profile-skeleton";
import { useSession } from "@/features/auth/session-provider";
import {
  customerProfileQueryOptions,
  isProfileDisconnected,
} from "@/lib/api/customer-profile";
import {
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { verificationLabel } from "@/lib/customer/profile-adapter";
import { formatAppointmentParts } from "@/lib/date-time/format";
import { routes, LOGIN_PATH } from "@/constants/routes";
import { useState } from "react";
import type { ProfileVerificationState } from "@/types/customer-profile";

function VerificationBadge({ state }: { state: ProfileVerificationState }) {
  const tone =
    state === "verified" ? "success" : state === "pending" ? "warning" : "neutral";
  return <Badge tone={tone}>{verificationLabel(state)}</Badge>;
}

export function ProfileOverviewScreen() {
  const router = useRouter();
  const { status, user, logout } = useSession();
  const userId = user?.id ?? "anonymous";
  const sessionReady = status === "authenticated" && Boolean(user?.id);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const profileQuery = useQuery({
    ...customerProfileQueryOptions(userId),
    enabled: sessionReady,
  });

  async function onConfirmLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.replace(LOGIN_PATH);
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  }

  if (status === "loading" || status === "unauthenticated" || status === "expired" || !sessionReady) {
    return <ProfileSkeleton />;
  }

  if (profileQuery.isPending) {
    return (
      <div className="profile-page">
        <PageHeader title="حساب کاربری" description="مشخصات و تنظیمات حساب شما." />
        <ProfileNav />
        <ProfileSkeleton />
      </div>
    );
  }

  if (profileQuery.isError) {
    const error = toAppApiError(profileQuery.error);
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
        <PageHeader title="حساب کاربری" />
        <ProfileNav />
        <ApiErrorState
          title={
            isProfileDisconnected(error)
              ? "پروفایل هنوز متصل نیست"
              : "بارگذاری حساب ممکن نشد"
          }
          description={error.message}
          requestId={error.requestId}
          onRetry={() => void profileQuery.refetch()}
        />
      </div>
    );
  }

  const profile = profileQuery.data;
  const created = profile.createdAt
    ? formatAppointmentParts(profile.createdAt, undefined)
    : null;

  return (
    <div className="profile-page">
      <PageHeader
        title="حساب کاربری"
        description="مشخصات تماس، امنیت و ترجیحات اعلان."
        secondaryActions={
          <Button variant="secondary" onClick={() => setLogoutOpen(true)}>
            خروج از حساب
          </Button>
        }
      />
      <ProfileNav />

      <section className="profile-card profile-card--hero" aria-labelledby="profile-overview">
        <div className="profile-overview__identity">
          <ProfileAvatar profile={profile} size="lg" />
          <div>
            <h2 id="profile-overview" className="text-card-title">
              {profile.displayName}
            </h2>
            {created?.date ? (
              <p className="text-caption">عضویت از {created.date}</p>
            ) : null}
          </div>
        </div>
        <dl className="booking-summary-list">
          <div>
            <dt>شماره موبایل</dt>
            <dd className="profile-overview__contact">
              <span className="ltr-value">{profile.phoneMasked ?? "—"}</span>
              <VerificationBadge state={profile.phoneVerified} />
            </dd>
          </div>
          <div>
            <dt>ایمیل</dt>
            <dd className="profile-overview__contact">
              <span className="ltr-value">{profile.emailMasked ?? "ثبت نشده"}</span>
              {profile.email ? <VerificationBadge state={profile.emailVerified} /> : null}
            </dd>
          </div>
          {profile.pendingEmailMasked ? (
            <div>
              <dt>ایمیل در انتظار تأیید</dt>
              <dd>
                <span className="ltr-value">{profile.pendingEmailMasked}</span>
              </dd>
            </div>
          ) : null}
        </dl>
        {!profile.avatarUploadSupported ? (
          <p className="text-caption">تصویر پروفایل از حروف اول نام نمایش داده می‌شود.</p>
        ) : null}
      </section>

      <div className="profile-actions">
        <Button asChild>
          <Link href={routes.customer.profileEdit}>ویرایش مشخصات</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href={routes.customer.profileSecurity}>امنیت حساب</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href={routes.customer.profileNotifications}>ترجیحات اعلان</Link>
        </Button>
      </div>

      <Alert
        tone="info"
        title="حذف یا غیرفعال‌سازی حساب"
        description="غیرفعال‌سازی حساب در حال حاضر از طریق Backend در دسترس نیست و در رابط کاربری نمایش داده نمی‌شود."
      />

      <ConfirmDialog
        open={logoutOpen}
        title="خروج از حساب"
        description="از حساب خارج می‌شوید. برای ادامه باید دوباره وارد شوید."
        confirmLabel="خروج"
        cancelLabel="ماندن"
        variant="destructive"
        busy={loggingOut}
        onConfirm={() => void onConfirmLogout()}
        onCancel={() => {
          if (!loggingOut) setLogoutOpen(false);
        }}
      />
    </div>
  );
}
