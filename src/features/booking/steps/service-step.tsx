"use client";

import { Radio, RadioGroup } from "@/components/ui/selection";
import { EmptyState, ApiErrorState } from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";
import { ServiceCard } from "@/features/services/service-card";
import { isBookableService } from "@/lib/public/service-adapters";
import type { AppApiError } from "@/types/api";
import type { ServiceListItemView } from "@/types/service";

export function ServiceStep({
  services,
  selectedId,
  onSelect,
  loading,
  error,
  onRetry,
  submitted,
}: {
  services: ServiceListItemView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  error?: AppApiError;
  onRetry?: () => void;
  submitted?: boolean;
}) {
  if (loading) {
    return (
      <div role="status" aria-busy="true" aria-label="در حال بارگذاری خدمات">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    );
  }
  if (error) {
    return (
      <ApiErrorState
        title="خدمات بارگذاری نشد"
        description={error.message}
        requestId={error.requestId}
        onRetry={onRetry}
      />
    );
  }
  const bookable = services.filter(isBookableService);
  if (bookable.length === 0) {
    return (
      <EmptyState
        title="خدمت قابل رزروی نیست"
        description="در حال حاضر امکان ثبت نوبت آنلاین برای خدمات این مجموعه وجود ندارد."
      />
    );
  }
  return (
    <RadioGroup
      legend="انتخاب خدمت"
      error={submitted && !selectedId ? "لطفاً یک خدمت را انتخاب کنید." : undefined}
    >
      <div className="booking-option-grid">
        {bookable.map((service) => (
          <Radio
            key={service.id}
            name="booking-service"
            value={service.id}
            checked={selectedId === service.id}
            className="booking-option"
            onChange={() => onSelect(service.id)}
            aria-label={service.name}
            aria-describedby={`booking-service-${service.id}`}
            label={
              <span id={`booking-service-${service.id}`} className="booking-option__content">
                <ServiceCard service={service} bookingEnabled={false} showActions={false} />
              </span>
            }
          />
        ))}
      </div>
    </RadioGroup>
  );
}
