"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/feedback/toast";
import { toAppApiError } from "@/lib/api/errors";
import { fetchPaymentReceiptUrl } from "@/lib/api/customer-payments";
import { EXTERNAL_LINK_REL } from "@/lib/public/links";

export function PaymentReceiptAction({
  paymentReference,
  receiptUrl,
  receiptAvailable,
}: {
  paymentReference: string;
  receiptUrl?: string;
  receiptAvailable: boolean;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const lock = useRef(false);

  if (!receiptAvailable && !receiptUrl) {
    return null;
  }

  if (receiptUrl) {
    return (
      <Button asChild variant="secondary">
        <a href={receiptUrl} target="_blank" rel={EXTERNAL_LINK_REL}>
          مشاهده رسید
        </a>
      </Button>
    );
  }

  async function openReceipt() {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setLoading(true);
    try {
      const result = await fetchPaymentReceiptUrl(paymentReference);
      if (result.outcome === "url") {
        window.open(result.url, "_blank", "noopener,noreferrer");
        return;
      }
      if (result.outcome === "missing_endpoint") {
        toast.warning("دریافت رسید هنوز در سرویس فعال نیست.");
        return;
      }
      toast.error("رسید این پرداخت در دسترس نیست.");
    } catch (error) {
      const normalized = toAppApiError(error);
      toast.error(normalized.message || "دریافت رسید ناموفق بود.");
    } finally {
      lock.current = false;
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" loading={loading} onClick={() => void openReceipt()}>
      مشاهده رسید
    </Button>
  );
}
