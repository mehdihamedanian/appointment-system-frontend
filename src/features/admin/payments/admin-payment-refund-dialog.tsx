"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Modal } from "@/components/feedback/modal";
import { InlineLoading } from "@/components/feedback/loading-states";
import { useToast } from "@/components/feedback/toast";
import {
  fetchAdminPaymentRefundPreview,
  submitAdminPaymentRefund,
} from "@/lib/api/admin-payments";
import {
  adminPaymentConflictMessage,
  isAdminPaymentConflict,
} from "@/lib/admin/payment-adapter";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import { toAppApiError } from "@/lib/api/errors";
import type { AdminPaymentDetailView } from "@/types/admin-payment";

export function AdminPaymentRefundDialog({
  open,
  payment,
  onClose,
  onSuccess,
}: {
  open: boolean;
  payment: AdminPaymentDetailView;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const lock = useRef(false);
  const idempotencyRef = useRef<string | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amountLabel, setAmountLabel] = useState("");
  const [reason, setReason] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [conflict, setConflict] = useState<string>();

  const previewQuery = useQuery({
    queryKey: [
      "admin",
      "payments",
      "refund-preview",
      payment.publicReference,
      payment.version ?? "",
    ],
    queryFn: () => fetchAdminPaymentRefundPreview(payment.publicReference),
    enabled: open,
    retry: false,
  });

  const preview = previewQuery.data;
  const previewLoading = previewQuery.isPending;
  const previewError = previewQuery.isError
    ? toAppApiError(previewQuery.error).message || "پیش‌نمایش بازپرداخت در دسترس نیست."
    : undefined;

  function resetForm() {
    setConfirmOpen(false);
    setAmountLabel("");
    setReason("");
    setReasonCode("");
    setConflict(undefined);
    idempotencyRef.current = undefined;
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  const reasonOptions =
    preview?.reasonOptions?.map((item) => ({ value: item.id, label: item.label })) ?? [];

  function canProceedToConfirm(): boolean {
    if (!preview) return false;
    if (preview.requiresReason && !reason.trim() && !reasonCode) return false;
    return true;
  }

  async function handleConfirmRefund() {
    if (lock.current || !preview) return;
    lock.current = true;
    setBusy(true);
    setConflict(undefined);
    if (!idempotencyRef.current) {
      idempotencyRef.current = createIdempotencyKey();
    }
    try {
      const result = await submitAdminPaymentRefund(
        payment.publicReference,
        {
          ...(preview.allowsPartial && amountLabel.trim() ? { amountLabel: amountLabel.trim() } : {}),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(reasonCode ? { reasonCode } : {}),
        },
        idempotencyRef.current,
      );
      setConfirmOpen(false);
      handleClose();
      if (result.pending) {
        toast.warning(result.message ?? "درخواست بازپرداخت ثبت شد و در حال پردازش است.");
      } else {
        toast.success(result.message ?? "بازپرداخت با موفقیت ثبت شد.");
      }
      onSuccess();
    } catch (error) {
      const normalized = toAppApiError(error);
      if (isAdminPaymentConflict(normalized)) {
        setConflict(adminPaymentConflictMessage());
        setConfirmOpen(false);
        onSuccess();
        return;
      }
      toast.error(normalized.message || "ثبت بازپرداخت ناموفق بود.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        open={open && !confirmOpen}
        title="بازپرداخت"
        description="مبالغ و سیاست بازپرداخت فقط از سرویس خوانده می‌شوند."
        size="md"
        preventClose={busy}
        onClose={handleClose}
        footer={
          <>
            <Button variant="secondary" onClick={handleClose} disabled={busy || previewLoading}>
              انصراف
            </Button>
            <Button
              variant="destructive"
              disabled={!canProceedToConfirm() || previewLoading || Boolean(previewError)}
              onClick={() => setConfirmOpen(true)}
            >
              ادامه
            </Button>
          </>
        }
      >
        {previewLoading ? <InlineLoading label="بارگذاری پیش‌نمایش بازپرداخت" /> : null}
        {previewError ? <Alert tone="error" title="خطا" description={previewError} /> : null}
        {conflict ? <Alert tone="warning" title="تعارض" description={conflict} /> : null}
        {preview ? (
          <div className="admin-payment-refund-form">
            {preview.summary ? <p>{preview.summary}</p> : null}
            <p>
              حداکثر قابل بازپرداخت:{" "}
              <strong className="ltr-value booking-money">{preview.maxRefundableLabel}</strong>
            </p>
            {preview.policyLabel ? <p className="text-caption">{preview.policyLabel}</p> : null}
            {preview.allowsPartial ? (
              <div>
                <Label htmlFor="refund-amount">مبلغ بازپرداخت (اختیاری برای بازپرداخت جزئی)</Label>
                <Input
                  id="refund-amount"
                  className="ltr-value"
                  value={amountLabel}
                  onChange={(event) => setAmountLabel(event.target.value)}
                  placeholder={preview.maxRefundableLabel}
                />
              </div>
            ) : null}
            {preview.requiresReason && reasonOptions.length > 0 ? (
              <div>
                <Label htmlFor="refund-reason-code">دلیل</Label>
                <Select
                  id="refund-reason-code"
                  value={reasonCode}
                  options={[{ value: "", label: "انتخاب کنید" }, ...reasonOptions]}
                  onChange={(value) => setReasonCode(value ?? "")}
                />
              </div>
            ) : null}
            {preview.requiresReason ? (
              <div>
                <Label htmlFor="refund-reason">توضیح (در صورت نیاز)</Label>
                <Input
                  id="refund-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="تأیید بازپرداخت"
        description={
          preview
            ? `آیا از بازپرداخت ${
                preview.allowsPartial && amountLabel.trim()
                  ? amountLabel.trim()
                  : preview.maxRefundableLabel
              } مطمئن هستید؟ این عمل قابل بازگشت نیست.`
            : "تأیید بازپرداخت"
        }
        confirmLabel="ثبت بازپرداخت"
        variant="destructive"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleConfirmRefund()}
      />
    </>
  );
}
