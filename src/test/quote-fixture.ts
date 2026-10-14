import { apiClient } from "@/lib/api/client";
import { isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { adaptBookingQuote, emptyBookingQuote } from "@/lib/booking/adapters";
import type * as BookingApi from "@/lib/api/booking";

/**
 * The Backend has no booking quote/preview endpoint (BACKEND_DEPENDENCIES.md,
 * "Remaining mismatches"), so the real `fetchBookingQuote` returns a
 * non-authoritative quote and quote-driven checkout UI cannot be reached against it.
 * Tests of that UI serve a fixture quote through the mocked `apiClient` at this
 * stand-in path; everything downstream (adapter, holds, payments) is real code.
 */
export const QUOTE_FIXTURE_PATH = "/__fixture__/booking-quote";

type Booking = typeof BookingApi;

/** `vi.mock("@/lib/api/booking", async (orig) => withFixtureQuote(await orig()))` */
export function withFixtureQuote(actual: Booking): Booking {
  const fetchBookingQuote: Booking["fetchBookingQuote"] = async (draft, signal, couponCode) => {
    try {
      return adaptBookingQuote(
        await apiClient<unknown>(QUOTE_FIXTURE_PATH, {
          method: "POST",
          signal,
          body: actual.quoteRequestBody(draft, couponCode),
        }),
      );
    } catch (error) {
      if (isNotFoundError(toAppApiError(error))) {
        return emptyBookingQuote();
      }
      throw error;
    }
  };
  return {
    ...actual,
    fetchBookingQuote,
    previewBookingCheckout: async (draft, signal) => {
      const quote = await fetchBookingQuote(draft, signal);
      return { checkoutPath: quote.checkoutPath, quote };
    },
  };
}
