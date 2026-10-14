"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { Radio, RadioGroup } from "@/components/ui/selection";
import { EmptyState, ApiErrorState } from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";
import { PublicProviderCard } from "@/features/providers/public-provider-card";
import { routes } from "@/constants/routes";
import {
  preferenceToRadioValue,
  preferencesEqual,
  reconcileProviderPreference,
  validateProviderPreference,
} from "@/lib/public/provider-preference";
import type { AppApiError } from "@/types/api";
import type {
  EligibleProvidersView,
  ProviderPreference,
  ProviderSelectionNotice,
} from "@/types/provider";

const NOTICE_COPY: Record<ProviderSelectionNotice, string> = {
  removed: "انتخاب متخصص دیگر معتبر نیست. لطفاً دوباره انتخاب کنید.",
  unavailable_service: "این متخصص برای خدمت انتخاب‌شده در دسترس نیست.",
  unavailable_branch: "این متخصص در شعبه انتخاب‌شده در دسترس نیست.",
};

function moveRadioFocus(event: KeyboardEvent<HTMLElement>) {
  const keys = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"];
  if (!keys.includes(event.key)) {
    return;
  }
  const radios = Array.from(
    event.currentTarget.querySelectorAll<HTMLInputElement>('input[type="radio"]:not(:disabled)'),
  );
  const current = radios.findIndex((item) => item === event.target);
  if (current < 0 || radios.length === 0) {
    return;
  }
  const rtl = document.documentElement.dir === "rtl";
  let delta = 0;
  if (event.key === "ArrowDown") {
    delta = 1;
  } else if (event.key === "ArrowUp") {
    delta = -1;
  } else if (event.key === "ArrowLeft") {
    delta = rtl ? 1 : -1;
  } else {
    delta = rtl ? -1 : 1;
  }
  event.preventDefault();
  const next = radios[(current + delta + radios.length) % radios.length];
  next?.focus();
  next?.click();
}

export function ProviderSelector({
  eligible,
  value,
  onChange,
  loading = false,
  error,
  onRetry,
  disabled = false,
  submitted = false,
  contextChange = "refresh",
  notice,
  onNotice,
  contactHref,
  validationError,
}: {
  eligible?: EligibleProvidersView;
  value?: ProviderPreference;
  onChange: (value: ProviderPreference | undefined) => void;
  loading?: boolean;
  error?: AppApiError;
  onRetry?: () => void;
  disabled?: boolean;
  submitted?: boolean;
  contextChange?: "service" | "branch" | "refresh";
  notice?: ProviderSelectionNotice;
  onNotice?: (notice?: ProviderSelectionNotice) => void;
  contactHref?: string;
  validationError?: string;
}) {
  const name = useId();
  const lastContext = useRef(contextChange);

  useEffect(() => {
    if (!eligible || loading) {
      return;
    }
    const reason =
      lastContext.current === contextChange ? "refresh" : contextChange;
    lastContext.current = contextChange;
    const next = reconcileProviderPreference(value, eligible, reason);
    if (!preferencesEqual(next.preference, value)) {
      onChange(next.preference);
    }
    if (next.notice) {
      onNotice?.(next.notice);
    }
  }, [contextChange, eligible, loading, onChange, onNotice, value]);

  if (loading) {
    return (
      <div className="provider-selector" role="status" aria-busy="true" aria-label="در حال بارگذاری متخصصان">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    );
  }

  if (error) {
    return (
      <ApiErrorState
        title="فهرست متخصصان دریافت نشد"
        description={error.message}
        requestId={error.requestId}
        onRetry={onRetry}
      />
    );
  }

  if (!eligible || eligible.mode === "not_applicable") {
    return null;
  }

  if (eligible.mode === "automatic") {
    return (
      <section className="provider-selector" aria-label="تخصیص متخصص">
        <Alert
          tone="info"
          title={eligible.assignmentLabel ?? "تخصیص توسط مجموعه"}
          description="متخصص این نوبت توسط مجموعه تعیین می‌شود."
        />
      </section>
    );
  }

  const showAny = eligible.mode === "optional" || eligible.anyAvailableAllowed;
  const radioValue = preferenceToRadioValue(value);
  const requiredEmpty = eligible.mode === "required" && eligible.providers.length === 0 && !showAny;
  const inlineError = submitted
    ? validationError ?? validateProviderPreference(eligible.mode, value, eligible)
    : undefined;

  if (requiredEmpty) {
    return (
      <EmptyState
        title="متخصص واجد شرایطی نیست"
        description="برای این خدمت در حال حاضر نمی‌توان نوبت با انتخاب متخصص ثبت کرد."
        action={
          <div className="ds-inline">
            <Button asChild variant="secondary">
              <Link href={routes.public.services}>بازگشت به خدمات</Link>
            </Button>
            {contactHref ? (
              <Button asChild>
                <a href={contactHref}>تماس با مجموعه</a>
              </Button>
            ) : null}
          </div>
        }
      />
    );
  }

  return (
    <div className="provider-selector">
      {notice ? (
        <Alert tone="warning" title={NOTICE_COPY[notice]} />
      ) : null}
      <RadioGroup
        legend="انتخاب متخصص"
        description={
          eligible.mode === "required"
            ? "یک متخصص را انتخاب کنید."
            : "می‌توانید یک متخصص را انتخاب کنید یا «فرقی ندارد» را بزنید."
        }
        error={inlineError}
      >
        <div className="provider-selector__grid" onKeyDown={moveRadioFocus}>
          {showAny ? (
            <Radio
              name={name}
              value="pref:any"
              checked={radioValue === "pref:any"}
              disabled={disabled}
              className="provider-option"
              data-selected={radioValue === "pref:any" ? "true" : undefined}
              onChange={() => onChange({ type: "any" })}
              label={
                <span className="public-provider-card public-provider-card--any">
                  <span className="public-provider-head">
                    <Avatar name="فرقی ندارد" alt="" />
                    <span className="public-provider-card__copy">
                      <span className="public-provider-card__name">فرقی ندارد</span>
                    </span>
                  </span>
                  {radioValue === "pref:any" ? (
                    <span className="text-caption">انتخاب‌شده</span>
                  ) : null}
                </span>
              }
              description="اولین متخصص واجد شرایط و در دسترس توسط مجموعه انتخاب می‌شود."
            />
          ) : null}
          {eligible.providers.map((provider) => {
            const selected = radioValue === provider.id;
            return (
              <Radio
                key={provider.id}
                name={name}
                value={provider.id}
                checked={selected}
                disabled={disabled}
                className="provider-option"
                data-selected={selected ? "true" : undefined}
                onChange={() =>
                  onChange({ type: "specific", providerId: provider.id })
                }
                label={
                  <PublicProviderCard provider={provider} selected={selected} />
                }
              />
            );
          })}
        </div>
      </RadioGroup>
      {eligible.mode === "optional" && eligible.providers.length === 0 && showAny ? (
        <p className="text-caption">
          متخصص مشخصی برای نمایش نیست. می‌توانید گزینه «فرقی ندارد» را انتخاب کنید.
        </p>
      ) : null}
    </div>
  );
}
