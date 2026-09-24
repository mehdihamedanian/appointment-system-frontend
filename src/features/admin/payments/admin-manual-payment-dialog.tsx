"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/form-field";
import { Modal } from "@/components/feedback/modal";
import { Radio, RadioGroup } from "@/components/ui/selection";
import { InlineLoading } from "@/components/feedback/loading-states";
import { useToast } from "@/components/feedback/toast";
import {
  fetchAdminManualPaymentOptions,
  submitAdminManualPayment,
} from "@/lib/api/admin-payments";
import {
  adminPaymentConflictMessage,
  isAdminPaymentConflict,
} from "@/lib/admin/payment-adapter";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import { toAppApiError } from "@/lib/api/errors";

export function AdminManualPaymentDialog({
  open,
  appointmentReference,
  onClose,
  onSuccess,
}: {
  open: boolean;
  appointmentReference?: string;
  onClose: () => void;
  onSuccess: (paymentReference: string) => void;
}) {
  const toast = useToast();
  const lock = useRef(false);
  const idempotencyRef = useRef<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<string>();
  const [method, setMethod] = useState<string>();
  const [amountLabel, setAmountLabel] = useState("");
  const [receiptReference, setReceiptReference] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const optionsQuery = useQuery({
    queryKey: ["admin", "payments", "manual-options", appointmentReference ?? ""],
    queryFn: () => fetchAdminManualPaymentOptions(appointmentReference!),
    enabled: open && Boolean(appointmentReference),
    retry: false,
  });

  const optionsView = optionsQuery.data;
  const loading = optionsQuery.isPending;
  const loadError = optionsQuery.isError
    ? toAppApiError(optionsQuery.error).message || "گزینه‌های پرداخت دستی در دسترس نیست."
    : undefined;

  const selectedOption = optionsView?.options.find((item) => item.type === method);
  const activeMethod =
    method ??
    (optionsView?.options.length === 1 ? optionsView.options[0]?.type : undefined);
  const activeOption =
    optionsView?.options.find((item) => item.type === activeMethod) ?? selectedOption;

  function resetForm() {
    setMethod(undefined);
    setAmountLabel("");
    setReceiptReference("");
    setInternalNote("");
    setConflict(undefined);
    idempotencyRef.current = undefined;
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    if (lock.current || !appointmentReference || !activeMethod || !activeOption) return;
    if (activeOption.requiresReceiptReference && !receiptReference.trim()) {
      toast.error("شماره رسید/مرجع الزامی است.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setConflict(undefined);
    if (!idempotencyRef.current) {
      idempotencyRef.current = createIdempotencyKey();
    }
    try {
      const result = await submitAdminManualPayment(
        {
          appointmentReference,
          method: activeMethod,
          ...(activeOption.allowsCustomAmount && amountLabel.trim()
            ? { amountLabel: amountLabel.trim() }
            : {}),
          ...(receiptReference.trim() ? { receiptReference: receiptReference.trim() } : {}),
          ...(internalNote.trim() ? { internalNote: internalNote.trim() } : {}),
        },
        idempotencyRef.current,
      );
      toast.success(result.message ?? "پرداخت دستی ثبت شد.");
      handleClose();
      onSuccess(result.paymentReference);
    } catch (error) {
      const normalized = toAppApiError(error);
      if (isAdminPaymentConflict(normalized)) {
        setConflict(adminPaymentConflictMessage());
        return;
      }
      toast.error(normalized.message || "ثبت پرداخت دستی ناموفق بود.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const unavailable =
    optionsView?.state === "unavailable" || (!loading && optionsView?.options.length === 0);

  return (
    <Modal
      open={open}
      title="ثبت پرداخت دستی"
      description="مبلغ و روش‌های مجاز فقط از سرویس خوانده می‌شوند."
      size="md"
      preventClose={busy}
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            انصراف
          </Button>
          <Button
            loading={busy}
            disabled={!activeMethod || loading || unavailable || Boolean(loadError)}
            onClick={() => void handleSubmit()}
          >
            ثبت پرداخت
          </Button>
        </>
      }
    >
      {loading ? <InlineLoading label="بارگذاری گزینه‌های پرداخت" /> : null}
      {loadError ? <Alert tone="error" title="خطا" description={loadError} /> : null}
      {conflict ? <Alert tone="warning" title="تعارض" description={conflict} /> : null}
      {unavailable && !loading ? (
        <Alert
          tone="info"
          title="غیرفعال"
          description="ثبت پرداخت دستی برای این نوبت در سرویس پشتیبانی نمی‌شود."
        />
      ) : null}
      {optionsView?.outstandingBalanceLabel ? (
        <p>
          مانده قابل پرداخت:{" "}
          <strong className="ltr-value booking-money">{optionsView.outstandingBalanceLabel}</strong>
        </p>
      ) : null}
      {optionsView?.options.length ? (
        <>
          <RadioGroup legend="روش پرداخت" orientation="vertical">
            {optionsView.options.map((option) => (
              <Radio
                key={option.type}
                name="admin-manual-payment-method"
                value={option.type}
                checked={activeMethod === option.type}
                onChange={() => setMethod(option.type)}
                disabled={busy}
                label={option.title}
                description={
                  <>
                    {option.description ? <span>{option.description}</span> : null}
                    {option.outstandingBalanceLabel ? (
                      <span>
                        {" "}
                        مانده:{" "}
                        <strong className="ltr-value booking-money">
                          {option.outstandingBalanceLabel}
                        </strong>
                      </span>
                    ) : null}
                  </>
                }
              />
            ))}
          </RadioGroup>
          {activeOption?.allowsCustomAmount ? (
            <div>
              <Label htmlFor="manual-payment-amount">مبلغ</Label>
              <Input
                id="manual-payment-amount"
                className="ltr-value"
                value={amountLabel}
                onChange={(event) => setAmountLabel(event.target.value)}
                placeholder={activeOption.maxAmountLabel ?? activeOption.outstandingBalanceLabel}
              />
              {activeOption.minAmountLabel ? (
                <p className="text-caption">حداقل: {activeOption.minAmountLabel}</p>
              ) : null}
              {activeOption.maxAmountLabel ? (
                <p className="text-caption">حداکثر: {activeOption.maxAmountLabel}</p>
              ) : null}
            </div>
          ) : null}
          {activeOption?.requiresReceiptReference ? (
            <div>
              <Label htmlFor="manual-payment-receipt">شماره رسید/مرجع</Label>
              <Input
                id="manual-payment-receipt"
                className="ltr-value"
                value={receiptReference}
                onChange={(event) => setReceiptReference(event.target.value)}
              />
            </div>
          ) : null}
          {activeOption?.allowsInternalNote ? (
            <div>
              <Label htmlFor="manual-payment-note">یادداشت داخلی</Label>
              <Input
                id="manual-payment-note"
                value={internalNote}
                onChange={(event) => setInternalNote(event.target.value)}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
