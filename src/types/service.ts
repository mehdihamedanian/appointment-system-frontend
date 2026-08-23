import type { AdditionalFieldDefinition } from "@/types/booking";

export type ServicePriceKind =
  | "fixed"
  | "startingFrom"
  | "free"
  | "contact"
  | "hidden";

export type ServicePriceView = {
  kind: ServicePriceKind;
  label: string;
};

export type ServiceDepositKind =
  | "none"
  | "fixed"
  | "percentage"
  | "full"
  | "payAtLocation";

export type ServiceDepositView = {
  kind: ServiceDepositKind;
  label: string;
};

export type ServiceAvailability =
  | "bookable"
  | "unavailable"
  | "bookingDisabled"
  | "inactive"
  | "archived"
  | "notFound";

export type ServiceCategoryView = {
  id: string;
  name: string;
};

export type ServiceListItemView = {
  id: string;
  slug?: string;
  name: string;
  shortDescription?: string;
  imageUrl?: string;
  durationMinutes?: number;
  pricing: ServicePriceView;
  deposit?: ServiceDepositView;
  category?: ServiceCategoryView;
  bookingEnabled: boolean;
  availability: ServiceAvailability;
};

export type ServiceDetailView = ServiceListItemView & {
  description?: string;
  preparation?: string;
  visitInfo?: string;
  policy?: string;
  additionalFields: AdditionalFieldDefinition[];
};

export type ServiceCatalogView = {
  items: ServiceListItemView[];
  paginated: boolean;
  totalCount?: number;
};

export type ServiceFilters = {
  q?: string;
  category?: string;
};
