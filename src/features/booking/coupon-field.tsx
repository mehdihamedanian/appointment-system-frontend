"use client";

import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CouponView } from "@/types/payment";

export function CouponField({
  value,
  onChange,
  onApply,
  onRemove,
  applied,
  loading,
  error,
  success,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onRemove: () => void;
  applied?: CouponView;
  loading?: boolean;
  error?: string;
  success?: string;
  disabled?: boolean;
}) {
  const appliedCode = applied?.status === "applied" ? applied.code : undefined;
  return (
    <div className="payment-coupon">
      <FormField
        id="payment-coupon"
        label="کد تخفیف"
        optional
        error={error}
        success={success}
      >
        <Input
          id="payment-coupon"
          name="coupon"
          value={appliedCode ?? value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || loading || Boolean(appliedCode)}
          invalid={Boolean(error)}
          autoComplete="off"
          aria-describedby={error ? "payment-coupon-error" : success ? "payment-coupon-success" : undefined}
        />
      </FormField>
      <div className="payment-coupon__actions">
        {appliedCode ? (
          <Button type="button" variant="secondary" onClick={onRemove} disabled={disabled || loading}>
            حذف کد
          </Button>
        ) : (
          <Button type="button" onClick={onApply} loading={loading} disabled={disabled || !value.trim()}>
            اعمال کد
          </Button>
        )}
      </div>
    </div>
  );
}
