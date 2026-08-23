import { isTimestampExpired } from "@/lib/date-time/format";
import type { AppApiError } from "@/types/api";
import type { BookingQuoteView, QuotePaymentMode } from "@/types/booking";

export function isQuoteChangedError(error: AppApiError): boolean {
  const code = error.code?.toUpperCase() ?? "";
  return (
    code.includes("QUOTE_CHANGED") ||
    code.includes("PRICE_CHANGED") ||
    code.includes("STALE_QUOTE") ||
    ((error.status === 409 || error.status === 422) &&
      (code.includes("PRICE") || code.includes("QUOTE")) &&
      !code.includes("SLOT"))
  );
}

export function isPolicyChangedError(error: AppApiError): boolean {
  const code = error.code?.toUpperCase() ?? "";
  return code.includes("POLICY") && (code.includes("CHANGE") || code.includes("UPDATED") || error.status === 409);
}

export function isQuoteExpiredError(error: AppApiError): boolean {
  const code = error.code?.toUpperCase() ?? "";
  return error.status === 410 || (code.includes("QUOTE") && code.includes("EXPIRED"));
}

/**
 * Remaining validity uses Backend expiresAt. If serverNow was provided, expiration
 * is compared on that clock plus elapsed local time since the Quote was received.
 * No timer is invented when expiresAt is omitted.
 */
export function isQuoteExpired(quote: BookingQuoteView, receivedAt: number, now = Date.now()): boolean {
  if (!quote.expiresAt) {
    return false;
  }
  const expires = Date.parse(quote.expiresAt);
  if (Number.isNaN(expires)) {
    return false;
  }
  if (quote.serverNow) {
    const serverNow = Date.parse(quote.serverNow);
    if (!Number.isNaN(serverNow)) {
      return serverNow + (now - receivedAt) >= expires;
    }
  }
  return isTimestampExpired(quote.expiresAt, new Date(now));
}

export const PAYMENT_MODE_COPY: Record<QuotePaymentMode, { title: string; description: string }> = {
  none: {
    title: "پرداخت لازم نیست",
    description: "پس از تأیید، نوبت بدون پرداخت آنلاین ثبت می‌شود.",
  },
  full: {
    title: "پرداخت کامل",
    description: "پس از تأیید، زمان به‌صورت موقت نگه داشته می‌شود تا پرداخت آنلاین تکمیل شود.",
  },
  deposit: {
    title: "پرداخت بیعانه",
    description: "بیعانه را سرویس نوبت‌دهی اعلام می‌کند. پس از تأیید، زمان به‌صورت موقت نگه داشته می‌شود.",
  },
  pay_at_location: {
    title: "پرداخت در محل",
    description: "مبلغ هنگام مراجعه پرداخت می‌شود.",
  },
  unknown: {
    title: "مسیر پرداخت هنوز مشخص نیست",
    description: "سرویس رزرو باید مبلغ و مسیر تأیید را اعلام کند.",
  },
};
