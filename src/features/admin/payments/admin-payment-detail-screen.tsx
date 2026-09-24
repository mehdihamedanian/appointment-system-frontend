"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import {
  ApiErrorState,
  NoResultsState,
  PermissionDeniedState,
  SessionExpiredState,
} from "@/components/feedback/app-states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/data-display";
import { ReferenceCopy } from "@/components/ui/reference-copy";
import { AdminManualPaymentDialog } from "@/features/admin/payments/admin-manual-payment-dialog";
import { AdminPaymentListSkeleton } from "@/features/admin/payments/admin-payment-skeleton";
import { AdminPaymentReceiptAction } from "@/features/admin/payments/admin-payment-receipt-action";
import { AdminPaymentRefundDialog } from "@/features/admin/payments/admin-payment-refund-dialog";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminPaymentDetailQueryOptions } from "@/lib/api/admin-payments";
import { invalidateAfterAdminPaymentMutation } from "@/lib/admin/payment-cache";
import { adminPaymentsHref, paymentPermission } from "@/lib/admin/payment-filters";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { isSafePublicId } from "@/lib/public/booking-href";
import { hasPermission } from "@/lib/permissions/access";
import { getStatusPresentation } from "@/lib/status/status-map";
import { routes } from "@/constants/routes";
import { PAYMENT_PENDING_STATUSES } from "@/types/payment-history";

export function AdminPaymentDetailScreen() {
  const { status, user } = useSession();
  const params = useParams<{ paymentReference?: string }>();
  const reference =
    typeof params.paymentReference === "string"
      ? decodeURIComponent(params.paymentReference)
      : "";
  const validReference = isSafePublicId(reference) ? reference : "";

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="جزئیات پرداخت" description="در حال بارگذاری…" />
        <AdminPaymentListSkeleton />
      </>
    );
  }

  if (!validReference) {
    return (
      <>
        <AdminPageHeader title="جزئیات پرداخت" />
        <NoResultsState
          title="پرداخت پیدا نشد"
          description="شناسه پرداخت معتبر نیست."
          action={
            <Button asChild variant="secondary">
              <Link href={routes.admin.payments}>بازگشت به پرداخت‌ها</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <PermissionGate permission={paymentPermission("detail")}>
      <AdminPaymentDetailReady userId={user.id} user={user} reference={validReference} />
    </PermissionGate>
  );
}

function AdminPaymentDetailReady({
  userId,
  user,
  reference,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  reference: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refundOpen, setRefundOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const query = useQuery(adminPaymentDetailQueryOptions(userId, reference));
  const payment = query.data;
  const error = query.isError ? toAppApiError(query.error) : undefined;

  const canRefund =
    payment?.allowedActions.issueRefund === true &&
    (hasPermission(user, paymentPermission("refund")) || user.permissionCodes.length === 0);
  const canManual =
    payment?.capabilities.supportsManualPayment === true &&
    payment?.allowedActions.recordManualPayment === true &&
    (hasPermission(user, paymentPermission("manual")) || user.permissionCodes.length === 0);
  const canRefresh = payment ? PAYMENT_PENDING_STATUSES.includes(payment.status) : false;

  function handleMutationSuccess() {
    void invalidateAfterAdminPaymentMutation(queryClient, userId, {
      paymentReference: reference,
      appointmentReference: payment?.appointment?.reference,
      customerReference: payment?.customer?.reference,
    });
    void query.refetch();
  }

  return (
    <>
      <AdminPageHeader
        title="جزئیات پرداخت"
        description="اطلاعات مالی فقط از سرویس خوانده می‌شود."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.paymentDetail(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.payments, label: "پرداخت‌ها" },
              { label: reference },
            ]}
          />
        }
        secondaryActions={
          canRefresh ? (
            <Button
              variant="secondary"
              leadingIcon={<RefreshCw size={16} aria-hidden="true" />}
              loading={query.isFetching && !query.isPending}
              onClick={() => void query.refetch()}
            >
              به‌روزرسانی وضعیت
            </Button>
          ) : undefined
        }
      />

      <span className="visually-hidden" aria-live="polite">
        {query.isPending ? "در حال بارگذاری جزئیات پرداخت." : ""}
        {payment ? `وضعیت پرداخت: ${getStatusPresentation(payment.status).label}` : ""}
      </span>

      {query.isPending ? <AdminPaymentListSkeleton /> : null}

      {error ? (
        isSessionExpiredError(error) ? (
          <SessionExpiredState
            title="نشست منقضی شد"
            description="لطفاً دوباره وارد شوید."
          />
        ) : isForbiddenError(error) ? (
          <PermissionDeniedState
            title="دسترسی به این پرداخت مجاز نیست"
            description="مجوز لازم را ندارید. از حساب خارج نمی‌شوید."
          />
        ) : isNotFoundError(error) ? (
          <NoResultsState
            title="پرداخت پیدا نشد"
            description="این پرداخت پیدا نشد یا دیگر در دسترس نیست."
            action={
              <Button asChild variant="secondary">
                <Link href={routes.admin.payments}>بازگشت به پرداخت‌ها</Link>
              </Button>
            }
          />
        ) : (
          <ApiErrorState
            title="جزئیات پرداخت بارگذاری نشد"
            description={error.message}
            requestId={error.requestId}
            onRetry={() => void query.refetch()}
          />
        )
      ) : null}

      {!query.isPending && !error && payment ? (
        <section className="admin-payment-detail" aria-labelledby="admin-payment-detail-title">
          <div className="admin-payment-detail__head">
            <div className="admin-payment-detail__badges">
              <StatusBadge status={payment.status} />
              {payment.refundStatus ? <StatusBadge status={payment.refundStatus} /> : null}
            </div>
            <h2 id="admin-payment-detail-title" className="admin-payment-detail__amount ltr-value booking-money">
              {payment.amountLabel}
            </h2>
            {payment.timestampLabel ? (
              <p>
                <time dateTime={payment.paidAt ?? payment.createdAt}>{payment.timestampLabel}</time>
              </p>
            ) : null}
            {payment.statusHint ? <p className="text-caption">{payment.statusHint}</p> : null}
            {payment.failureMessage ? (
              <Alert tone="error" title="پیام خطا" description={payment.failureMessage} />
            ) : null}
          </div>

          <dl className="admin-payment-detail__meta">
            <div>
              <dt>کد پرداخت</dt>
              <dd>
                <ReferenceCopy value={payment.publicReference} label="رونوشت کد پرداخت" />
              </dd>
            </div>
            {payment.transactionReference ? (
              <div>
                <dt>کد تراکنش</dt>
                <dd>
                  <ReferenceCopy value={payment.transactionReference} label="رونوشت کد تراکنش" />
                </dd>
              </div>
            ) : null}
            {payment.customer ? (
              <div>
                <dt>مشتری</dt>
                <dd>
                  <Link href={payment.customer.href}>{payment.customer.displayName}</Link>
                  {payment.customer.phoneMasked ? (
                    <span className="text-caption ltr-value"> {payment.customer.phoneMasked}</span>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {payment.appointment ? (
              <div>
                <dt>نوبت</dt>
                <dd>
                  <Link href={payment.appointment.href}>
                    {payment.appointment.serviceName ?? payment.appointment.reference}
                  </Link>
                  {payment.appointment.whenLabel ? (
                    <span className="text-caption"> — {payment.appointment.whenLabel}</span>
                  ) : null}
                  {payment.appointment.status ? (
                    <StatusBadge status={payment.appointment.status} />
                  ) : null}
                </dd>
              </div>
            ) : null}
            {payment.methodLabel ? (
              <div>
                <dt>روش پرداخت</dt>
                <dd>{payment.methodLabel}</dd>
              </div>
            ) : null}
            {payment.classificationLabel ? (
              <div>
                <dt>نوع پرداخت</dt>
                <dd>{payment.classificationLabel}</dd>
              </div>
            ) : null}
            {payment.remainingBalanceLabel ? (
              <div>
                <dt>مانده نوبت</dt>
                <dd className="ltr-value booking-money">{payment.remainingBalanceLabel}</dd>
              </div>
            ) : null}
            {payment.instrumentMasked ? (
              <div>
                <dt>ابزار پرداخت</dt>
                <dd className="ltr-value">{payment.instrumentMasked}</dd>
              </div>
            ) : null}
            {payment.gatewayName ? (
              <div>
                <dt>درگاه</dt>
                <dd>{payment.gatewayName}</dd>
              </div>
            ) : null}
            {payment.refundAmountLabel ? (
              <div>
                <dt>مبلغ بازپرداخت</dt>
                <dd className="ltr-value booking-money">{payment.refundAmountLabel}</dd>
              </div>
            ) : null}
            {payment.branch?.name ? (
              <div>
                <dt>شعبه</dt>
                <dd>{payment.branch.name}</dd>
              </div>
            ) : null}
          </dl>

          {payment.timeline.length > 0 ? (
            <section aria-labelledby="admin-payment-timeline-title">
              <h3 id="admin-payment-timeline-title" className="text-card-title">
                تاریخچه پرداخت
              </h3>
              <ol className="admin-payment-timeline">
                {payment.timeline.map((entry) => (
                  <li key={entry.id}>
                    <div className="admin-payment-timeline__head">
                      <strong>{entry.label}</strong>
                      {entry.status ? <StatusBadge status={entry.status} /> : null}
                    </div>
                    {entry.timestampLabel ? (
                      <time dateTime={entry.timestamp}>{entry.timestampLabel}</time>
                    ) : null}
                    {entry.description ? <p className="text-caption">{entry.description}</p> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {payment.internalNotes.length > 0 ? (
            <section aria-labelledby="admin-payment-notes-title">
              <h3 id="admin-payment-notes-title" className="text-card-title">
                یادداشت‌های داخلی
              </h3>
              <p className="text-caption admin-payment-internal-label">فقط داخلی — برای مشتری نمایش داده نمی‌شود</p>
              <ul className="admin-payment-notes">
                {payment.internalNotes.map((note) => (
                  <li key={note.id}>
                    <p>{note.body}</p>
                    {note.authorLabel || note.createdAtLabel ? (
                      <p className="text-caption">
                        {[note.authorLabel, note.createdAtLabel].filter(Boolean).join(" — ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="admin-payment-detail__actions">
            {canRefund ? (
              <Button variant="destructive" onClick={() => setRefundOpen(true)}>
                بازپرداخت
              </Button>
            ) : null}
            {canManual && payment.appointment?.reference ? (
              <Button variant="secondary" onClick={() => setManualOpen(true)}>
                ثبت پرداخت دستی
              </Button>
            ) : null}
            {payment.canDownloadReceipt ? (
              <AdminPaymentReceiptAction
                paymentReference={payment.publicReference}
                receiptUrl={payment.receiptUrl}
                receiptAvailable={payment.receiptAvailable}
              />
            ) : null}
            {payment.appointment ? (
              <Button asChild variant="secondary">
                <Link href={payment.appointment.href}>مشاهده نوبت</Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost">
              <Link href={adminPaymentsHref()}>بازگشت به فهرست</Link>
            </Button>
          </div>
        </section>
      ) : null}

      {payment && refundOpen ? (
        <AdminPaymentRefundDialog
          open={refundOpen}
          payment={payment}
          onClose={() => setRefundOpen(false)}
          onSuccess={handleMutationSuccess}
        />
      ) : null}

      {payment?.appointment?.reference ? (
        <AdminManualPaymentDialog
          open={manualOpen}
          appointmentReference={payment.appointment.reference}
          onClose={() => setManualOpen(false)}
          onSuccess={(paymentReference) => {
            handleMutationSuccess();
            router.push(routes.admin.paymentDetail(paymentReference));
          }}
        />
      ) : null}
    </>
  );
}
