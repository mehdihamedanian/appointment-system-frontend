import type { ProviderPreference, ProviderSelectionMode } from "@/types/provider";

export type AvailabilityContext = {
  serviceId: string;
  branchId?: string;
  providerPreference:
    | { type: "specific"; providerId: string }
    | { type: "any" }
    | { type: "automatic" }
    | { type: "not_applicable" };
};

export type CalendarDayAvailability = "available" | "closed" | "no_capacity" | "unavailable";

export type CalendarDayVisualState =
  | "default"
  | "today"
  | "selected"
  | "available"
  | "closed"
  | "no_capacity"
  | "unavailable"
  | "past"
  | "outside"
  | "disabled"
  | "loading"
  | "unknown";

export type BookableDateDay = {
  date: string;
  status: CalendarDayAvailability;
};

export type AvailableSlotStatus = "available" | "unavailable" | "held" | "past";

export type AvailableSlotView = {
  id: string;
  startsAt: string;
  endsAt?: string;
  label: string;
  status: AvailableSlotStatus;
};

export type SlotPeriod = "morning" | "afternoon" | "evening";

export type SlotPeriodGroup = {
  period: SlotPeriod;
  label: string;
  slots: AvailableSlotView[];
};

export type AvailabilityQueryInput = {
  serviceId?: string | null;
  branchId?: string | null;
  preference: ProviderPreference;
  requiresBranch: boolean;
  providerMode: ProviderSelectionMode;
};
