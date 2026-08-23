"use client";

import { Alert } from "@/components/ui/alert";
import { PAYMENT_MODE_COPY } from "@/lib/booking/quote";
import type { QuotePaymentMode } from "@/types/booking";

export function CheckoutStep({
  paymentMode = "unknown",
}: {
  paymentMode?: QuotePaymentMode;
}) {
  const copy = PAYMENT_MODE_COPY[paymentMode];
  return (
    <Alert
      tone={paymentMode === "unknown" ? "warning" : "info"}
      title={copy.title}
      description={copy.description}
    />
  );
}
