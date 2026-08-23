"use client";

import { Radio, RadioGroup } from "@/components/ui/selection";
import type { PaymentMethodType, PaymentOptionView } from "@/types/payment";

export function PaymentMethodList({
  options,
  selected,
  onSelect,
  disabled,
}: {
  options: PaymentOptionView[];
  selected?: PaymentMethodType;
  onSelect: (type: PaymentMethodType) => void;
  disabled?: boolean;
}) {
  if (options.length === 0) {
    return null;
  }
  if (options.length === 1) {
    const only = options[0]!;
    return (
      <section className="payment-method-single" aria-labelledby="payment-method-title">
        <h2 id="payment-method-title" className="text-card-title">
          {only.title}
        </h2>
        <p className="ds-help">{only.description}</p>
        {only.payableNowLabel ? (
          <p>
            قابل پرداخت اکنون: <strong className="ltr-value booking-money">{only.payableNowLabel}</strong>
          </p>
        ) : null}
        {only.remainingAtLocationLabel ? (
          <p>
            مانده در محل: <strong className="ltr-value booking-money">{only.remainingAtLocationLabel}</strong>
            {only.remainingDueLabel ? <span className="ds-help"> {only.remainingDueLabel}</span> : null}
          </p>
        ) : null}
        {only.refundability ? <p className="ds-help">{only.refundability}</p> : null}
      </section>
    );
  }

  return (
    <RadioGroup legend="روش پرداخت" orientation="vertical">
      {options.map((option) => (
        <Radio
          key={option.type}
          name="payment-method"
          value={option.type}
          checked={selected === option.type}
          onChange={() => onSelect(option.type)}
          disabled={disabled}
          label={option.title}
          description={
            <>
              <span>{option.description}</span>
              {option.payableNowLabel ? (
                <span>
                  {" "}
                  قابل پرداخت اکنون: <span className="ltr-value booking-money">{option.payableNowLabel}</span>
                </span>
              ) : null}
              {option.remainingAtLocationLabel ? (
                <span>
                  {" "}
                  مانده در محل: <span className="ltr-value booking-money">{option.remainingAtLocationLabel}</span>
                </span>
              ) : null}
              {option.refundability ? <span> {option.refundability}</span> : null}
            </>
          }
        />
      ))}
    </RadioGroup>
  );
}
