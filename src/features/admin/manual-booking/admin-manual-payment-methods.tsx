"use client";

import { Radio, RadioGroup } from "@/components/ui/selection";
import type { AdminManualPaymentOptionView, AdminManualPaymentMethodType } from "@/types/admin-manual-booking";

export function AdminManualPaymentMethodList({
  options,
  selected,
  onSelect,
  disabled,
}: {
  options: AdminManualPaymentOptionView[];
  selected?: AdminManualPaymentMethodType;
  onSelect: (type: AdminManualPaymentMethodType) => void;
  disabled?: boolean;
}) {
  if (options.length === 0) {
    return null;
  }
  if (options.length === 1) {
    const only = options[0]!;
    return (
      <section aria-labelledby="admin-payment-method-title">
        <h3 id="admin-payment-method-title" className="text-card-title">
          {only.title}
        </h3>
        <p className="ds-help">{only.description}</p>
        {only.payableNowLabel ? (
          <p>
            قابل پرداخت اکنون:{" "}
            <strong className="ltr-value booking-money">{only.payableNowLabel}</strong>
          </p>
        ) : null}
        {only.remainingAtLocationLabel ? (
          <p>
            مانده در محل:{" "}
            <strong className="ltr-value booking-money">{only.remainingAtLocationLabel}</strong>
          </p>
        ) : null}
      </section>
    );
  }
  return (
    <RadioGroup legend="روش پرداخت" orientation="vertical">
      {options.map((option) => (
        <Radio
          key={option.type}
          name="admin-payment-method"
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
                  قابل پرداخت اکنون:{" "}
                  <span className="ltr-value booking-money">{option.payableNowLabel}</span>
                </span>
              ) : null}
              {option.remainingAtLocationLabel ? (
                <span>
                  {" "}
                  مانده در محل:{" "}
                  <span className="ltr-value booking-money">{option.remainingAtLocationLabel}</span>
                </span>
              ) : null}
            </>
          }
        />
      ))}
    </RadioGroup>
  );
}
