"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  ApiErrorState,
  SessionExpiredState,
} from "@/components/feedback/app-states";
import { toast } from "@/components/feedback/toast";
import { PageHeader } from "@/components/layout/page-header";
import { ChangePasswordForm } from "@/features/auth/change-password-form";
import { AuthFormAlert } from "@/features/auth/auth-form-alert";
import { OtpCountdown } from "@/features/auth/otp-countdown";
import { OtpInput } from "@/features/auth/otp-input";
import { ProfileNav } from "@/features/customer/profile-nav";
import { ProfileSkeleton } from "@/features/customer/profile-skeleton";
import { useSession } from "@/features/auth/session-provider";
import { useSubmitting } from "@/features/auth/use-submitting";
import { authConfig } from "@/config/auth";
import {
  customerProfileQueryOptions,
  isProfileDisconnected,
  requestEmailChange,
  requestPhoneChange,
  resendEmailChangeOtp,
  resendPhoneChangeOtp,
  verifyEmailChange,
  verifyPhoneChange,
} from "@/lib/api/customer-profile";
import {
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { mapAuthError, type AuthFormMessage } from "@/lib/auth/error-map";
import { focusField, pickFieldError } from "@/lib/auth/form";
import { isValidIranMobile, normalizeIranMobile } from "@/lib/auth/phone";
import { queryKeys } from "@/lib/query/keys";
import { routes, LOGIN_PATH } from "@/constants/routes";
import type { ProfileChallengeView } from "@/types/customer-profile";

function PhoneChangeSection({
  canChange,
  currentMasked,
  userId,
}: {
  canChange: boolean;
  currentMasked?: string;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const { applyAuthenticated, user, refetch } = useSession();
  const { submitting, run } = useSubmitting();
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string>();
  const [challenge, setChallenge] = useState<ProfileChallengeView | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [message, setMessage] = useState<AuthFormMessage | null>(null);

  if (!canChange) {
    return (
      <section className="profile-card" aria-labelledby="phone-change">
        <h2 id="phone-change" className="text-card-title">
          تغییر شماره موبایل
        </h2>
        <p className="text-caption">تغییر شماره موبایل برای این حساب فعال نیست.</p>
        {currentMasked ? (
          <p>
            شماره فعلی: <span className="ltr-value">{currentMasked}</span>
          </p>
        ) : null}
      </section>
    );
  }

  async function onRequest() {
    setMessage(null);
    if (!isValidIranMobile(phone)) {
      setPhoneError("شماره موبایل را به‌صورت صحیح وارد کنید.");
      focusField("newPhone");
      return;
    }
    try {
      const next = await requestPhoneChange(normalizeIranMobile(phone));
      setChallenge(next);
      setCode("");
      setMessage({
        tone: "success",
        title: "کد ارسال شد",
        description: "کد تأیید به شماره جدید ارسال شد.",
      });
    } catch (error) {
      const apiError = toAppApiError(error);
      setMessage(mapAuthError(apiError));
      setPhoneError(pickFieldError(apiError.fieldErrors, ["phone", "mobile"]));
    }
  }

  async function onVerify() {
    if (!challenge) return;
    setMessage(null);
    if (code.length !== authConfig.otpLength) {
      setCodeError("کد را کامل وارد کنید.");
      return;
    }
    try {
      const result = await verifyPhoneChange(challenge.challengeId, code);
      queryClient.setQueryData(queryKeys.customer.profile(userId), result.profile);
      if (result.user) {
        applyAuthenticated(result.user);
      } else {
        applyAuthenticated({
          id: result.profile.id,
          displayName: result.profile.displayName,
          email: result.profile.email,
          phone: result.profile.phone,
          permissionCodes: user?.permissionCodes ?? [],
          adminPanelAccess: user?.adminPanelAccess ?? "unknown",
        });
      }
      void refetch();
      setChallenge(null);
      setPhone("");
      setCode("");
      setMessage({
        tone: "success",
        title: "شماره موبایل به‌روز شد",
        description: "شماره جدید پس از تأیید ثبت شد.",
      });
      toast.success("شماره موبایل به‌روز شد.");
    } catch (error) {
      const apiError = toAppApiError(error);
      setMessage(mapAuthError(apiError));
      setCode("");
    }
  }

  async function onResend() {
    if (!challenge) return;
    try {
      const next = await resendPhoneChangeOtp(challenge.challengeId);
      setChallenge(next);
      setMessage({
        tone: "success",
        title: "کد دوباره ارسال شد",
        description: "کد جدید را وارد کنید.",
      });
    } catch (error) {
      setMessage(mapAuthError(toAppApiError(error)));
    }
  }

  return (
    <section className="profile-card" aria-labelledby="phone-change">
      <h2 id="phone-change" className="text-card-title">
        تغییر شماره موبایل
      </h2>
      {currentMasked ? (
        <p className="text-caption">
          شماره فعلی: <span className="ltr-value">{currentMasked}</span>
        </p>
      ) : null}
      <AuthFormAlert message={message} />
      {!challenge ? (
        <form
          className="profile-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(onRequest);
          }}
          noValidate
        >
          <FormField id="newPhone" label="شماره موبایل جدید" required error={phoneError}>
            <PhoneInput
              id="newPhone"
              name="newPhone"
              value={phone}
              onValueChange={(value) => {
                setPhone(value);
                setPhoneError(undefined);
              }}
              invalid={Boolean(phoneError)}
              disabled={submitting}
            />
          </FormField>
          <Button type="submit" loading={submitting} disabled={submitting}>
            ارسال کد تأیید
          </Button>
        </form>
      ) : (
        <form
          className="profile-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(onVerify);
          }}
          noValidate
        >
          <p>
            کد به <span className="ltr-value">{challenge.maskedDestination}</span> ارسال شد.
          </p>
          <OtpInput
            id="phone-otp"
            value={code}
            error={codeError}
            disabled={submitting}
            onChange={(value) => {
              setCode(value);
              setCodeError(undefined);
            }}
          />
          <Button type="submit" loading={submitting} disabled={submitting}>
            تأیید شماره جدید
          </Button>
          <OtpCountdown
            resendAvailableAt={challenge.resendAvailableAt}
            disabled={submitting}
            onResend={() => void run(onResend)}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() => {
              setChallenge(null);
              setCode("");
            }}
          >
            تغییر شماره
          </Button>
        </form>
      )}
    </section>
  );
}

function EmailChangeSection({
  canChange,
  currentMasked,
  pendingMasked,
  userId,
}: {
  canChange: boolean;
  currentMasked?: string;
  pendingMasked?: string;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const { submitting, run } = useSubmitting();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [challenge, setChallenge] = useState<ProfileChallengeView | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [message, setMessage] = useState<AuthFormMessage | null>(null);

  if (!canChange) {
    return (
      <section className="profile-card" aria-labelledby="email-change">
        <h2 id="email-change" className="text-card-title">
          تغییر ایمیل
        </h2>
        <p className="text-caption">تغییر ایمیل برای این حساب فعال نیست.</p>
      </section>
    );
  }

  async function onRequest() {
    setMessage(null);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("ایمیل معتبر وارد کنید.");
      focusField("newEmail");
      return;
    }
    try {
      const result = await requestEmailChange({
        email: email.trim(),
        currentPassword: password || undefined,
      });
      queryClient.setQueryData(queryKeys.customer.profile(userId), result.profile);
      setPassword("");
      if (result.challenge) {
        setChallenge(result.challenge);
        setMessage({
          tone: "success",
          title: "کد تأیید ارسال شد",
          description: "ایمیل جدید تا تأیید نهایی در حالت انتظار می‌ماند.",
        });
      } else {
        setMessage({
          tone: "success",
          title: "درخواست ثبت شد",
          description: result.profile.pendingEmailMasked
            ? `ایمیل ${result.profile.pendingEmailMasked} در انتظار تأیید است.`
            : "برای تکمیل، لینک یا کد تأیید را دنبال کنید.",
        });
        toast.success("درخواست تغییر ایمیل ثبت شد.");
      }
    } catch (error) {
      const apiError = toAppApiError(error);
      setMessage(mapAuthError(apiError));
      setEmailError(pickFieldError(apiError.fieldErrors, ["email"]));
      setPasswordError(pickFieldError(apiError.fieldErrors, ["currentPassword", "password"]));
    }
  }

  async function onVerify() {
    if (!challenge) return;
    if (code.length !== authConfig.otpLength) {
      setCodeError("کد را کامل وارد کنید.");
      return;
    }
    try {
      const profile = await verifyEmailChange(challenge.challengeId, code);
      queryClient.setQueryData(queryKeys.customer.profile(userId), profile);
      setChallenge(null);
      setEmail("");
      setCode("");
      setMessage({
        tone: "success",
        title: "ایمیل تأیید شد",
        description: "ایمیل جدید به‌صورت تأییدشده ثبت شد.",
      });
      toast.success("ایمیل تأیید شد.");
    } catch (error) {
      setMessage(mapAuthError(toAppApiError(error)));
      setCode("");
    }
  }

  async function onResend() {
    if (!challenge) return;
    try {
      const next = await resendEmailChangeOtp(challenge.challengeId);
      setChallenge(next);
      setMessage({
        tone: "success",
        title: "کد دوباره ارسال شد",
        description: "کد جدید را وارد کنید.",
      });
    } catch (error) {
      setMessage(mapAuthError(toAppApiError(error)));
    }
  }

  return (
    <section className="profile-card" aria-labelledby="email-change">
      <h2 id="email-change" className="text-card-title">
        تغییر ایمیل
      </h2>
      {currentMasked ? (
        <p className="text-caption">
          ایمیل فعلی: <span className="ltr-value">{currentMasked}</span>
        </p>
      ) : null}
      {pendingMasked ? (
        <Alert
          tone="warning"
          title="ایمیل در انتظار تأیید"
          description={`آدرس ${pendingMasked} هنوز تأیید نشده است.`}
        />
      ) : null}
      <AuthFormAlert message={message} />
      {!challenge ? (
        <form
          className="profile-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(onRequest);
          }}
          noValidate
        >
          <FormField id="newEmail" label="ایمیل جدید" required error={emailError}>
            <Input
              id="newEmail"
              type="email"
              className="ltr-value"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailError(undefined);
              }}
              invalid={Boolean(emailError)}
              disabled={submitting}
              autoComplete="email"
            />
          </FormField>
          <FormField
            id="emailPassword"
            label="رمز عبور فعلی"
            optional
            error={passwordError}
            description="در صورت نیاز Backend، رمز فعلی درخواست می‌شود."
          >
            <PasswordInput
              id="emailPassword"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError(undefined);
              }}
              autoComplete="current-password"
              invalid={Boolean(passwordError)}
              disabled={submitting}
            />
          </FormField>
          <Button type="submit" loading={submitting} disabled={submitting}>
            ثبت درخواست تغییر ایمیل
          </Button>
        </form>
      ) : (
        <form
          className="profile-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(onVerify);
          }}
          noValidate
        >
          <p>
            کد به <span className="ltr-value">{challenge.maskedDestination}</span> ارسال شد.
          </p>
          <OtpInput
            id="email-otp"
            value={code}
            error={codeError}
            disabled={submitting}
            onChange={(value) => {
              setCode(value);
              setCodeError(undefined);
            }}
          />
          <Button type="submit" loading={submitting} disabled={submitting}>
            تأیید ایمیل جدید
          </Button>
          <OtpCountdown
            resendAvailableAt={challenge.resendAvailableAt}
            disabled={submitting}
            onResend={() => void run(onResend)}
          />
        </form>
      )}
    </section>
  );
}

export function ProfileSecurityScreen() {
  const { status, user } = useSession();
  const userId = user?.id ?? "anonymous";
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  const profileQuery = useQuery({
    ...customerProfileQueryOptions(userId),
    enabled: sessionReady,
  });

  if (status === "loading" || status === "unauthenticated" || status === "expired" || !sessionReady) {
    return <ProfileSkeleton label="در حال بارگذاری امنیت حساب" />;
  }

  if (profileQuery.isPending) {
    return (
      <div className="profile-page">
        <PageHeader title="امنیت حساب" />
        <ProfileNav />
        <ProfileSkeleton label="در حال بارگذاری امنیت حساب" />
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
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
        <PageHeader title="امنیت حساب" />
        <ProfileNav />
        <ApiErrorState
          title={
            isProfileDisconnected(error)
              ? "پروفایل هنوز متصل نیست"
              : "بارگذاری تنظیمات امنیتی ممکن نشد"
          }
          description={error.message}
          requestId={error.requestId}
          onRetry={() => void profileQuery.refetch()}
        />
      </div>
    );
  }

  const profile = profileQuery.data;

  return (
    <div className="profile-page">
      <PageHeader
        title="امنیت حساب"
        description="رمز عبور، شماره موبایل و ایمیل را مدیریت کنید."
        breadcrumb={
          <Link href={routes.customer.profile} className="profile-back">
            بازگشت به حساب
          </Link>
        }
      />
      <ProfileNav />

      {profile.canChangePassword ? (
        <section className="profile-card" aria-labelledby="password-change">
          <h2 id="password-change" className="text-card-title">
            تغییر رمز عبور
          </h2>
          <ChangePasswordForm
            onSuccess={() => {
              toast.success("رمز عبور تغییر کرد.");
            }}
          />
        </section>
      ) : (
        <Alert
          tone="info"
          title="تغییر رمز عبور"
          description="تغییر رمز عبور برای این حساب از طریق Backend فعال نیست."
        />
      )}

      <PhoneChangeSection
        canChange={profile.canChangePhone}
        currentMasked={profile.phoneMasked}
        userId={userId}
      />
      <EmailChangeSection
        canChange={profile.canChangeEmail}
        currentMasked={profile.emailMasked}
        pendingMasked={profile.pendingEmailMasked}
        userId={userId}
      />
    </div>
  );
}
