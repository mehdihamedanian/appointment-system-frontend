"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SearchInput } from "@/components/ui/search-input";
import { ApiErrorState, EmptyState } from "@/components/feedback/app-states";
import { InlineLoading } from "@/components/feedback/loading-states";
import { pickFieldError } from "@/lib/auth/form";
import { isValidIranMobile, normalizeIranMobile } from "@/lib/auth/phone";
import {
  adminCustomerSearchQueryOptions,
  createAdminCustomer,
  SEARCH_MIN_LENGTH,
} from "@/lib/api/admin-manual-booking";
import { isDuplicateCustomerError } from "@/lib/admin/manual-booking-adapter";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import { isApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import type { AppApiError } from "@/types/api";
import type {
  AdminManualBookingCustomerView,
  AdminManualBookingCreateCustomerInput,
} from "@/types/admin-manual-booking";
import type { SessionUser } from "@/types/session";

const SEARCH_DEBOUNCE_MS = 300;

export function AdminManualBookingCustomerStep({
  userId,
  user,
  selected,
  onSelect,
  submitted,
  canCreateCustomer = true,
}: {
  userId: string;
  user: SessionUser;
  selected: AdminManualBookingCustomerView | null;
  onSelect: (customer: AdminManualBookingCustomerView | null) => void;
  submitted?: boolean;
  canCreateCustomer?: boolean;
}) {
  const listId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [draftQuery, setDraftQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<AppApiError>();
  const [duplicateCustomer, setDuplicateCustomer] = useState<AdminManualBookingCustomerView>();
  const [form, setForm] = useState<AdminManualBookingCreateCustomerInput>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AdminManualBookingCreateCustomerInput, string>>>({});
  const createLock = useRef(false);
  const canViewContact =
    hasPermission(user, "admin.customers.view") || user.permissionCodes.length === 0;

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(draftQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery]);

  const searchQuery = useQuery({
    ...adminCustomerSearchQueryOptions(userId, debouncedQuery),
  });

  const results = searchQuery.data?.items ?? [];
  const showResults =
    !selected &&
    debouncedQuery.length >= SEARCH_MIN_LENGTH &&
    (searchQuery.isFetching || searchQuery.isFetched);
  const clampedActiveIndex =
    results.length === 0 ? -1 : Math.min(Math.max(activeIndex, 0), results.length - 1);

  function clearSelection() {
    onSelect(null);
    setDraftQuery("");
    setDebouncedQuery("");
    setCreateOpen(false);
    setDuplicateCustomer(undefined);
    window.requestAnimationFrame(() => searchRef.current?.focus());
  }

  function selectCustomer(customer: AdminManualBookingCustomerView) {
    onSelect(customer);
    setDraftQuery("");
    setDebouncedQuery("");
    setCreateOpen(false);
    setDuplicateCustomer(undefined);
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showResults || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && clampedActiveIndex >= 0) {
      event.preventDefault();
      selectCustomer(results[clampedActiveIndex]!);
    } else if (event.key === "Escape") {
      setDraftQuery("");
    }
  }

  async function onCreateCustomer() {
    if (createLock.current) return;
    const nextErrors: typeof fieldErrors = {};
    if (!form.firstName.trim()) nextErrors.firstName = "نام را وارد کنید.";
    if (!form.lastName.trim()) nextErrors.lastName = "نام خانوادگی را وارد کنید.";
    if (!isValidIranMobile(form.phone)) nextErrors.phone = "شماره موبایل معتبر نیست.";
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    createLock.current = true;
    setCreateSubmitting(true);
    setCreateError(undefined);
    setDuplicateCustomer(undefined);
    try {
      const result = await createAdminCustomer(
        {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: normalizeIranMobile(form.phone),
          email: form.email?.trim() || undefined,
        },
        createIdempotencyKey(),
      );
      if (result.outcome === "missing_endpoint") {
        setCreateError({
          status: 404,
          message: "ثبت مشتری هنوز به سرویس متصل نشده است.",
        });
        return;
      }
      if (result.outcome === "duplicate") {
        setDuplicateCustomer(result.customer);
        setCreateError({
          status: 409,
          message: result.message ?? "مشتری با این مشخصات از قبل وجود دارد.",
        });
        return;
      }
      selectCustomer(result.customer);
    } catch (error) {
      const apiError = isApiError(error) ? error.toJSON() : toAppApiError(error);
      if (isDuplicateCustomerError(apiError)) {
        setCreateError(apiError);
        return;
      }
      if (isNotFoundError(apiError)) {
        setCreateError({ status: 404, message: "ثبت مشتری در دسترس نیست." });
        return;
      }
      setFieldErrors({
        firstName: pickFieldError(apiError.fieldErrors, ["firstName", "givenName"]),
        lastName: pickFieldError(apiError.fieldErrors, ["lastName", "familyName"]),
        phone: pickFieldError(apiError.fieldErrors, ["phone", "mobile"]),
        email: pickFieldError(apiError.fieldErrors, ["email"]),
      });
      setCreateError(apiError.fieldErrors ? undefined : apiError);
    } finally {
      createLock.current = false;
      setCreateSubmitting(false);
    }
  }

  if (selected) {
    return (
      <section className="admin-manual-booking-customer" aria-labelledby="selected-customer">
        <h2 id="selected-customer" className="text-card-title">
          مشتری انتخاب‌شده
        </h2>
        <dl className="booking-summary">
          <div>
            <dt>نام</dt>
            <dd>{selected.displayName}</dd>
          </div>
          {selected.reference ? (
            <div>
              <dt>شناسه</dt>
              <dd className="ltr-value">{selected.reference}</dd>
            </div>
          ) : null}
          {canViewContact && selected.phoneMasked ? (
            <div>
              <dt>موبایل</dt>
              <dd className="ltr-value">{selected.phoneMasked}</dd>
            </div>
          ) : null}
          {canViewContact && selected.emailMasked ? (
            <div>
              <dt>ایمیل</dt>
              <dd className="ltr-value">{selected.emailMasked}</dd>
            </div>
          ) : null}
          {!canViewContact ? (
            <div>
              <dt>تماس</dt>
              <dd>اطلاعات تماس برای شما نمایش داده نمی‌شود.</dd>
            </div>
          ) : null}
        </dl>
        <Button variant="secondary" onClick={clearSelection}>
          تغییر مشتری
        </Button>
      </section>
    );
  }

  return (
    <section className="admin-manual-booking-customer" aria-labelledby="customer-search-title">
      <h2 id="customer-search-title" className="text-card-title">
        جستجوی مشتری
      </h2>
      {submitted ? (
        <p className="ds-error" role="alert">
          لطفاً یک مشتری را انتخاب کنید یا مشتری جدید بسازید.
        </p>
      ) : null}
      <FormField id="customerSearch" label="جستجو با نام، موبایل، ایمیل یا شناسه">
        <SearchInput
          ref={searchRef}
          id="customerSearch"
          aria-label="جستجوی مشتری"
          aria-controls={showResults ? listId : undefined}
          aria-expanded={showResults}
          aria-autocomplete="list"
          aria-activedescendant={clampedActiveIndex >= 0 ? `${listId}-option-${clampedActiveIndex}` : undefined}
          role="combobox"
          value={draftQuery}
          onChange={(event) => {
            setDraftQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onSearchKeyDown}
          loading={searchQuery.isFetching}
          onClear={() => setDraftQuery("")}
          placeholder="حداقل ۲ کاراکتر"
        />
      </FormField>
      <p className="visually-hidden" aria-live="polite">
        {searchQuery.isFetching
          ? "در حال جستجوی مشتری"
          : debouncedQuery.length >= SEARCH_MIN_LENGTH && results.length === 0 && searchQuery.isFetched
            ? "نتیجه‌ای یافت نشد"
            : results.length > 0
              ? `${results.length} نتیجه`
              : ""}
      </p>
      {searchQuery.isError ? (
        <ApiErrorState
          title="جستجوی مشتری انجام نشد"
          description={toAppApiError(searchQuery.error).message}
          requestId={toAppApiError(searchQuery.error).requestId}
          onRetry={() => void searchQuery.refetch()}
        />
      ) : null}
      {showResults && !searchQuery.isError ? (
        <div className="admin-customer-search-results">
          {searchQuery.isFetching && !searchQuery.data ? <InlineLoading label="در حال جستجو" /> : null}
          {!searchQuery.isFetching && results.length === 0 ? (
            <EmptyState
              title="مشتری پیدا نشد"
              description="عبارت دیگری را امتحان کنید یا در صورت مجوز، مشتری جدید بسازید."
            />
          ) : (
            <ul id={listId} role="listbox" aria-label="نتایج جستجوی مشتری">
              {results.map((customer, index) => (
                <li key={customer.id} role="presentation">
                  <button
                    type="button"
                    id={`${listId}-option-${index}`}
                    role="option"
                    aria-selected={clampedActiveIndex === index}
                    className="admin-customer-search-option"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectCustomer(customer)}
                  >
                    <strong>{customer.displayName}</strong>
                    {customer.reference ? (
                      <span className="ltr-value text-caption">{customer.reference}</span>
                    ) : null}
                    {canViewContact && customer.phoneMasked ? (
                      <span className="ltr-value">{customer.phoneMasked}</span>
                    ) : null}
                    {!canViewContact && customer.phoneMasked ? (
                      <span className="text-caption">تماس محدود</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {canCreateCustomer ? (
        <div className="admin-manual-booking-create-customer">
          {!createOpen ? (
            <Button variant="secondary" onClick={() => setCreateOpen(true)}>
              ثبت مشتری جدید
            </Button>
          ) : (
            <form
              className="admin-manual-booking-create-form"
              onSubmit={(event) => {
                event.preventDefault();
                void onCreateCustomer();
              }}
              noValidate
            >
              <h3 className="text-card-title">ثبت سریع مشتری</h3>
              {createError ? (
                <Alert tone="error" title="ثبت مشتری انجام نشد" description={createError.message} />
              ) : null}
              {duplicateCustomer ? (
                <Alert
                  tone="warning"
                  title="مشتری مشابه وجود دارد"
                  description={`${duplicateCustomer.displayName} — می‌توانید همین مشتری را انتخاب کنید.`}
                />
              ) : null}
              {duplicateCustomer ? (
                <Button type="button" variant="secondary" size="sm" onClick={() => selectCustomer(duplicateCustomer)}>
                  انتخاب این مشتری
                </Button>
              ) : null}
              <FormField id="createFirstName" label="نام" required error={fieldErrors.firstName}>
                <Input
                  id="createFirstName"
                  value={form.firstName}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                  invalid={Boolean(fieldErrors.firstName)}
                  disabled={createSubmitting}
                />
              </FormField>
              <FormField id="createLastName" label="نام خانوادگی" required error={fieldErrors.lastName}>
                <Input
                  id="createLastName"
                  value={form.lastName}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                  invalid={Boolean(fieldErrors.lastName)}
                  disabled={createSubmitting}
                />
              </FormField>
              <FormField id="createPhone" label="موبایل" required error={fieldErrors.phone}>
                <PhoneInput
                  id="createPhone"
                  value={form.phone}
                  onValueChange={(value) => setForm((current) => ({ ...current, phone: value }))}
                  invalid={Boolean(fieldErrors.phone)}
                  disabled={createSubmitting}
                />
              </FormField>
              <FormField id="createEmail" label="ایمیل" error={fieldErrors.email}>
                <Input
                  id="createEmail"
                  type="email"
                  className="ltr-value"
                  dir="ltr"
                  value={form.email ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  invalid={Boolean(fieldErrors.email)}
                  disabled={createSubmitting}
                />
              </FormField>
              <div className="booking-wizard__nav">
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
                  انصراف
                </Button>
                <Button type="submit" loading={createSubmitting}>
                  ثبت و انتخاب
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </section>
  );
}
