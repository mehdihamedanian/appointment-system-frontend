"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  ApiErrorState,
  SessionExpiredState,
} from "@/components/feedback/app-states";
import { toast } from "@/components/feedback/toast";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileNav } from "@/features/customer/profile-nav";
import { ProfileSkeleton } from "@/features/customer/profile-skeleton";
import { useUnsavedChangesWarning } from "@/features/customer/use-unsaved-changes-warning";
import { useSession } from "@/features/auth/session-provider";
import { useSubmitting } from "@/features/auth/use-submitting";
import {
  customerProfileQueryOptions,
  isProfileDisconnected,
  updateCustomerProfile,
} from "@/lib/api/customer-profile";
import {
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { focusField, pickFieldError } from "@/lib/auth/form";
import { asSafeText } from "@/lib/public/read";
import { queryKeys } from "@/lib/query/keys";
import { routes, LOGIN_PATH } from "@/constants/routes";
import type { CustomerProfileView } from "@/types/customer-profile";

function isValidEmail(value: string): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function ProfileEditForm({
  profile,
  userId,
}: {
  profile: CustomerProfileView;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const { user, applyAuthenticated, refetch } = useSession();
  const { submitting, run } = useSubmitting();
  const [firstName, setFirstName] = useState(profile.firstName ?? "");
  const [lastName, setLastName] = useState(profile.lastName ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [baseline, setBaseline] = useState({
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    email: profile.email ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
  }>({});
  const [formError, setFormError] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();

  const dirty = useMemo(
    () =>
      firstName.trim() !== baseline.firstName ||
      lastName.trim() !== baseline.lastName ||
      email.trim() !== baseline.email,
    [firstName, lastName, email, baseline],
  );

  useUnsavedChangesWarning(dirty && !submitting);

  async function onSave() {
    setFormError(undefined);
    setSuccessMessage(undefined);
    const nextErrors = {
      firstName: firstName.trim() ? undefined : "نام را وارد کنید.",
      lastName: lastName.trim() ? undefined : "نام خانوادگی را وارد کنید.",
      email: isValidEmail(email) ? undefined : "ایمیل واردشده معتبر نیست.",
    };
    setFieldErrors(nextErrors);
    const first = nextErrors.firstName
      ? "firstName"
      : nextErrors.lastName
        ? "lastName"
        : nextErrors.email
          ? "email"
          : null;
    if (first) {
      focusField(first);
      return;
    }
    if (!dirty) {
      return;
    }

    try {
      const updated = await updateCustomerProfile({
        firstName: asSafeText(firstName.trim()) ?? firstName.trim(),
        lastName: asSafeText(lastName.trim()) ?? lastName.trim(),
        email: email.trim() ? email.trim() : undefined,
      });
      queryClient.setQueryData(queryKeys.customer.profile(userId), updated);
      applyAuthenticated({
        id: updated.id,
        displayName: updated.displayName,
        email: updated.email,
        phone: updated.phone,
        permissionCodes: user?.permissionCodes ?? [],
        adminPanelAccess: user?.adminPanelAccess ?? "unknown",
      });
      void refetch();
      setBaseline({
        firstName: updated.firstName ?? "",
        lastName: updated.lastName ?? "",
        email: updated.email ?? "",
      });
      setFirstName(updated.firstName ?? "");
      setLastName(updated.lastName ?? "");
      setEmail(updated.email ?? "");
      setSuccessMessage("مشخصات ذخیره شد.");
      toast.success("مشخصات ذخیره شد.");
    } catch (error) {
      const apiError = toAppApiError(error);
      setFormError(apiError.message);
      setFieldErrors({
        firstName: pickFieldError(apiError.fieldErrors, ["firstName", "givenName"]),
        lastName: pickFieldError(apiError.fieldErrors, ["lastName", "familyName"]),
        email: pickFieldError(apiError.fieldErrors, ["email"]),
      });
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(onSave);
  }

  return (
    <>
      <span className="visually-hidden" aria-live="polite">
        {successMessage ?? ""}
      </span>
      {successMessage ? (
        <Alert tone="success" title="ذخیره شد" description={successMessage} />
      ) : null}
      {formError ? <Alert tone="error" title="ذخیره نشد" description={formError} /> : null}
      {dirty ? (
        <p className="text-caption" role="status">
          تغییرات ذخیره‌نشده دارید.
        </p>
      ) : null}

      <form className="profile-card profile-form" onSubmit={onSubmit} noValidate>
        <FormField id="firstName" label="نام" required error={fieldErrors.firstName}>
          <Input
            id="firstName"
            name="firstName"
            value={firstName}
            onChange={(event) => {
              setFirstName(event.target.value);
              setFieldErrors((current) => ({ ...current, firstName: undefined }));
            }}
            autoComplete="given-name"
            invalid={Boolean(fieldErrors.firstName)}
            disabled={submitting}
          />
        </FormField>
        <FormField id="lastName" label="نام خانوادگی" required error={fieldErrors.lastName}>
          <Input
            id="lastName"
            name="lastName"
            value={lastName}
            onChange={(event) => {
              setLastName(event.target.value);
              setFieldErrors((current) => ({ ...current, lastName: undefined }));
            }}
            autoComplete="family-name"
            invalid={Boolean(fieldErrors.lastName)}
            disabled={submitting}
          />
        </FormField>
        <FormField
          id="email"
          label="ایمیل"
          optional
          error={fieldErrors.email}
          description="تغییر ایمیل ممکن است نیاز به تأیید داشته باشد."
        >
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            autoComplete="email"
            className="ltr-value"
            invalid={Boolean(fieldErrors.email)}
            disabled={submitting}
          />
        </FormField>
        <p className="text-caption">
          شماره موبایل:{" "}
          <span className="ltr-value">{profile.phoneMasked ?? "—"}</span> — برای تغییر به{" "}
          <Link href={routes.customer.profileSecurity}>امنیت حساب</Link> بروید.
        </p>
        <div className="profile-form__footer">
          <Button variant="secondary" asChild disabled={submitting}>
            <Link href={routes.customer.profile}>انصراف</Link>
          </Button>
          <Button type="submit" loading={submitting} disabled={!dirty || submitting}>
            ذخیره تغییرات
          </Button>
        </div>
      </form>
    </>
  );
}

export function ProfileEditScreen() {
  const { status, user } = useSession();
  const userId = user?.id ?? "anonymous";
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  const profileQuery = useQuery({
    ...customerProfileQueryOptions(userId),
    enabled: sessionReady,
  });

  if (status === "loading" || status === "unauthenticated" || status === "expired" || !sessionReady) {
    return <ProfileSkeleton label="در حال بارگذاری ویرایش مشخصات" />;
  }

  if (profileQuery.isPending) {
    return (
      <div className="profile-page">
        <PageHeader title="ویرایش مشخصات" />
        <ProfileNav />
        <ProfileSkeleton label="در حال بارگذاری ویرایش مشخصات" />
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
        <PageHeader title="ویرایش مشخصات" />
        <ProfileNav />
        <ApiErrorState
          title={
            isProfileDisconnected(error)
              ? "پروفایل هنوز متصل نیست"
              : "بارگذاری مشخصات ممکن نشد"
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
        title="ویرایش مشخصات"
        description="نام و ایمیل قابل ویرایش است. تغییر شماره موبایل از بخش امنیت انجام می‌شود."
        breadcrumb={
          <Link href={routes.customer.profile} className="profile-back">
            بازگشت به حساب
          </Link>
        }
      />
      <ProfileNav />
      <ProfileEditForm
        key={`${profile.id}:${profile.firstName ?? ""}:${profile.lastName ?? ""}:${profile.email ?? ""}`}
        profile={profile}
        userId={userId}
      />
    </div>
  );
}
