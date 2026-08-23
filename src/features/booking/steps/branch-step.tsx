"use client";

import { Radio, RadioGroup } from "@/components/ui/selection";
import { EmptyState, ApiErrorState } from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";
import { Card } from "@/components/ui/data-display";
import type { AppApiError } from "@/types/api";
import type { PublicBranch } from "@/types/public";

export function BranchStep({
  branches,
  selectedId,
  onSelect,
  loading,
  error,
  onRetry,
  submitted,
}: {
  branches: PublicBranch[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  error?: AppApiError;
  onRetry?: () => void;
  submitted?: boolean;
}) {
  if (loading) {
    return (
      <div aria-busy="true" aria-label="در حال بارگذاری شعبه‌ها">
        <Skeleton variant="card" />
      </div>
    );
  }
  if (error) {
    return (
      <ApiErrorState
        title="شعبه‌ها بارگذاری نشد"
        description={error.message}
        requestId={error.requestId}
        onRetry={onRetry}
      />
    );
  }
  if (branches.length === 0) {
    return (
      <EmptyState
        title="شعبه‌ای برای این خدمت نیست"
        description="این خدمت در حال حاضر در شعبه‌ای ارائه نمی‌شود."
      />
    );
  }
  return (
    <RadioGroup
      legend="انتخاب شعبه"
      error={submitted && !selectedId ? "لطفاً یک شعبه را انتخاب کنید." : undefined}
    >
      <div className="booking-option-grid">
        {branches.map((branch) => (
          <Radio
            key={branch.id}
            name="booking-branch"
            value={branch.id}
            checked={selectedId === branch.id}
            className="booking-option"
            onChange={() => onSelect(branch.id)}
            label={
              <Card>
                <h3>{branch.name}</h3>
                {selectedId === branch.id ? <p className="text-caption">انتخاب‌شده</p> : null}
                {branch.address ? <p>{branch.address}</p> : null}
                {branch.phone ? <p className="ltr-value">{branch.phone}</p> : null}
              </Card>
            }
          />
        ))}
      </div>
    </RadioGroup>
  );
}
