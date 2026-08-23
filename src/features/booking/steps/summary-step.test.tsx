import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SummaryStep, canSubmitQuote } from "@/features/booking/steps/summary-step";
import { emptyBookingQuote } from "@/lib/booking/adapters";
import { emptyBookingDraft, type BookingQuoteView } from "@/types/booking";
import { renderWithProviders } from "@/test/render";

const quote: BookingQuoteView = {
  id: "q1",
  lines: [
    { id: "base", label: "مبلغ خدمت", amountLabel: "۳۰۰٬۰۰۰ تومان", kind: "base" },
    { id: "discount", label: "تخفیف", amountLabel: "۵۰٬۰۰۰ تومان", kind: "discount" },
  ],
  finalAmountLabel: "۲۵۰٬۰۰۰ تومان",
  payableNowLabel: "۱۰۰٬۰۰۰ تومان",
  payableAtLocationLabel: "۱۵۰٬۰۰۰ تومان",
  depositLabel: "۱۰۰٬۰۰۰ تومان",
  paymentMode: "deposit",
  checkoutPath: "pay_deposit",
  paymentOptions: [],
  durationMinutes: 30,
  changed: false,
  policyChanged: false,
  authoritative: true,
  timezone: "Asia/Tehran",
  slot: { id: "slot_1", startsAt: "2026-08-22T09:00:00+03:30", label: "09:00" },
  policySnapshot: {
    summary: "لغو تا ۲۴ ساعت قبل رایگان است.",
    fullText: "متن کامل قوانین",
    consentRequired: true,
    consentLabel: "قوانین لغو را می‌پذیرم",
  },
};

function draft() {
  const next = emptyBookingDraft();
  next.serviceId = "svc_1";
  next.date = "2026-08-22";
  next.slotId = "slot_1";
  next.additionalData = { note: "<b>سلام</b>", secret: "1234" };
  return next;
}

describe("SummaryStep", () => {
  it("shows a quote skeleton while loading", () => {
    renderWithProviders(
      <SummaryStep
        draft={draft()}
        fields={[]}
        quoteLoading
        quoteReviewed
        quoteReceivedAt={Date.now()}
        policyAccepted={false}
        onPolicyAccepted={() => undefined}
        onEdit={() => undefined}
      />,
    );
    expect(screen.getByLabelText("در حال بارگذاری استعلام رزرو")).toBeInTheDocument();
  });

  it("shows quote errors with retry", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <SummaryStep
        draft={draft()}
        fields={[]}
        quoteError={{ status: 500, message: "خطای استعلام", requestId: "req_9" }}
        quoteReviewed
        quoteReceivedAt={Date.now()}
        policyAccepted={false}
        onPolicyAccepted={() => undefined}
        onEdit={() => undefined}
        onRetryQuote={onRetry}
      />,
    );
    expect(screen.getByText("استعلام رزرو دریافت نشد")).toBeInTheDocument();
    expect(screen.getByText("req_9")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("presents specific, any, automatic and omitted provider modes", () => {
    const specific = renderWithProviders(
      <SummaryStep
        draft={{ ...draft(), providerPreference: { type: "specific", providerId: "p1" } }}
        eligible={{
          mode: "optional",
          anyAvailableAllowed: true,
          providers: [{ id: "p1", name: "دکتر آریا", publicTitle: "پوست", relatedServiceNames: [], branchNames: [] }],
        }}
        fields={[]}
        quote={quote}
        quoteReviewed
        quoteReceivedAt={Date.now()}
        policyAccepted
        onPolicyAccepted={() => undefined}
        onEdit={() => undefined}
      />,
    );
    expect(specific.getByText(/دکتر آریا/)).toBeInTheDocument();
    specific.unmount();

    const any = renderWithProviders(
      <SummaryStep
        draft={{ ...draft(), providerPreference: { type: "any" } }}
        fields={[]}
        quote={quote}
        quoteReviewed
        quoteReceivedAt={Date.now()}
        policyAccepted
        onPolicyAccepted={() => undefined}
        onEdit={() => undefined}
      />,
    );
    expect(any.getByText("فرقی ندارد")).toBeInTheDocument();
    any.unmount();

    const automatic = renderWithProviders(
      <SummaryStep
        draft={{ ...draft(), providerPreference: { type: "automatic" } }}
        fields={[]}
        quote={quote}
        quoteReviewed
        quoteReceivedAt={Date.now()}
        policyAccepted
        onPolicyAccepted={() => undefined}
        onEdit={() => undefined}
      />,
    );
    expect(automatic.getByText("تخصیص توسط مجموعه")).toBeInTheDocument();
    automatic.unmount();

    const omitted = renderWithProviders(
      <SummaryStep
        draft={draft()}
        fields={[]}
        quote={quote}
        quoteReviewed
        quoteReceivedAt={Date.now()}
        policyAccepted
        onPolicyAccepted={() => undefined}
        onEdit={() => undefined}
      />,
    );
    expect(omitted.queryByRole("heading", { name: "متخصص" })).not.toBeInTheDocument();
  });

  it("keeps total and payable now distinct and shows deposit copy", () => {
    renderWithProviders(
      <SummaryStep
        draft={draft()}
        service={{
          id: "svc_1",
          name: "ویزیت",
          pricing: { kind: "fixed", label: "اعلام نشده" },
          bookingEnabled: true,
          availability: "bookable",
          additionalFields: [],
        }}
        fields={[]}
        quote={quote}
        quoteReviewed
        quoteReceivedAt={Date.now()}
        policyAccepted
        onPolicyAccepted={() => undefined}
        onEdit={() => undefined}
      />,
    );
    expect(screen.getByText("مبلغ کل")).toBeInTheDocument();
    expect(screen.getByText("قابل پرداخت اکنون")).toBeInTheDocument();
    expect(screen.getByText("۲۵۰٬۰۰۰ تومان")).toBeInTheDocument();
    expect(screen.getAllByText("۱۰۰٬۰۰۰ تومان").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("پرداخت بیعانه")).toBeInTheDocument();
  });

  it("requires policy consent and uses an accessible label", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    renderWithProviders(
      <SummaryStep
        draft={draft()}
        fields={[]}
        quote={quote}
        quoteReviewed
        quoteReceivedAt={Date.now()}
        policyAccepted={false}
        onPolicyAccepted={onAccept}
        onEdit={() => undefined}
      />,
    );
    expect(canSubmitQuote(quote, { quoteReviewed: true, policyAccepted: false, expired: false })).toBe(false);
    await user.click(screen.getByRole("checkbox", { name: "قوانین لغو را می‌پذیرم" }));
    expect(onAccept).toHaveBeenCalledWith(true);
    expect(canSubmitQuote(quote, { quoteReviewed: true, policyAccepted: true, expired: false })).toBe(true);
  });

  it("edits previous steps with descriptive labels", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderWithProviders(
      <SummaryStep
        draft={draft()}
        fields={[]}
        quote={quote}
        quoteReviewed
        quoteReceivedAt={Date.now()}
        policyAccepted
        onPolicyAccepted={() => undefined}
        onEdit={onEdit}
      />,
    );
    await user.click(screen.getByRole("button", { name: "ویرایش زمان نوبت" }));
    expect(onEdit).toHaveBeenCalledWith("time");
  });

  it("announces a price change and does not auto-continue", () => {
    renderWithProviders(
      <SummaryStep
        draft={draft()}
        fields={[]}
        quote={{ ...quote, changed: true }}
        quoteReviewed={false}
        quoteReceivedAt={Date.now()}
        policyAccepted
        onPolicyAccepted={() => undefined}
        onEdit={() => undefined}
      />,
    );
    expect(screen.getByText("مبلغ یا شرایط رزرو به‌روزرسانی شد.")).toBeInTheDocument();
    expect(canSubmitQuote({ ...quote, changed: true }, { quoteReviewed: false, policyAccepted: true, expired: false })).toBe(
      false,
    );
  });

  it("disables confirmation after quote expiration", () => {
    const expiredQuote = { ...quote, expiresAt: "2026-08-22T09:00:00Z", serverNow: "2026-08-22T08:59:00Z" };
    renderWithProviders(
      <SummaryStep
        draft={draft()}
        fields={[]}
        quote={expiredQuote}
        quoteReviewed
        quoteReceivedAt={Date.parse("2026-08-22T08:59:00Z")}
        now={Date.parse("2026-08-22T09:01:00Z")}
        policyAccepted
        onPolicyAccepted={() => undefined}
        onEdit={() => undefined}
      />,
    );
    expect(screen.getByText("اعتبار استعلام به پایان رسید.")).toBeInTheDocument();
    expect(canSubmitQuote(expiredQuote, { quoteReviewed: true, policyAccepted: true, expired: true })).toBe(false);
  });

  it("escapes notes and masks sensitive answers", () => {
    renderWithProviders(
      <SummaryStep
        draft={draft()}
        fields={[
          { id: "note", label: "یادداشت", type: "textarea", required: false, options: [], sensitive: false },
          { id: "secret", label: "کد ملی", type: "text", required: false, options: [], sensitive: true },
        ]}
        quote={quote}
        quoteReviewed
        quoteReceivedAt={Date.now()}
        policyAccepted
        onPolicyAccepted={() => undefined}
        onEdit={() => undefined}
      />,
    );
    expect(screen.getByText("سلام")).toBeInTheDocument();
    expect(screen.queryByText("<b>سلام</b>")).not.toBeInTheDocument();
    expect(screen.getByText("••••")).toBeInTheDocument();
    expect(screen.queryByText("1234")).not.toBeInTheDocument();
    expect(screen.queryByText("note")).not.toBeInTheDocument();
  });

  it("does not invent amounts when the quote is not authoritative", () => {
    renderWithProviders(
      <SummaryStep
        draft={draft()}
        fields={[]}
        quote={emptyBookingQuote()}
        quoteReviewed
        quoteReceivedAt={Date.now()}
        policyAccepted
        onPolicyAccepted={() => undefined}
        onEdit={() => undefined}
      />,
    );
    expect(screen.getByText("مبالغ نمایشی قطعی نیست")).toBeInTheDocument();
    expect(canSubmitQuote(emptyBookingQuote(), { quoteReviewed: true, policyAccepted: true, expired: false })).toBe(false);
  });

  it("shows pay-at-location copy from the backend mode", () => {
    renderWithProviders(
      <SummaryStep
        draft={draft()}
        fields={[]}
        quote={{ ...quote, paymentMode: "pay_at_location", checkoutPath: "pay_at_location", depositLabel: undefined }}
        quoteReviewed
        quoteReceivedAt={Date.now()}
        policyAccepted
        onPolicyAccepted={() => undefined}
        onEdit={() => undefined}
      />,
    );
    expect(screen.getByText("پرداخت در محل")).toBeInTheDocument();
  });
});
