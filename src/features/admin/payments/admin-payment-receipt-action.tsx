"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/feedback/toast";
import { toAppApiError } from "@/lib/api/errors";
import { fetchAdminPaymentReceiptUrl } from "@/lib/api/admin-payments";
import { EXTERNAL_LINK_REL } from "@/lib/public/links";

export function AdminPaymentReceiptAction({
  paymentReference,
  receiptUrl,
  receiptAvailable,
  size = "md",
}: {
  paymentReference: string;
  receiptUrl?: string;
  receiptAvailable: boolean;
  size?: "sm" | "md";
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const lock = useRef(false);

  if (!receiptAvailable && !receiptUrl) {
    return null;
  }

  if (receiptUrl) {
    return (
      <Button asChild variant="secondary" size={size}>
        <a href={receiptUrl} target="_blank" rel={EXTERNAL_LINK_REL}>
          رسید
        </a>
      </Button>
    );
  }

  async function openReceipt() {
    if (lock.current) return;
    lock.current = true;
    setLoading(true);
    try {
      const result = await fetchAdminPaymentReceiptUrl(paymentReference);
      if (result.outcome === "url") {
        window.open(result.url, "_blank", "noopener,noreferrer");
        toast.success("رسید در پنجره جدید باز شد.");
        return;
      }
      if (result.outcome === "missing_endpoint") {
        toast.warning("دریافت رسید هنوز در سرویس فعال نیست.");
        return;
      }
      toast.error("رسید این پرداخت در دسترس نیست.");
    } catch (error) {
      toast.error(toAppApiError(error).message || "دریافت رسید ناموفق بود.");
    } finally {
      lock.current = false;
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size={size} loading={loading} onClick={() => void openReceipt()}>
      رسید
    </Button>
  );
}
