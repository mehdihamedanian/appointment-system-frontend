export type PublicSocialLink = {
  label: string;
  href: string;
};

export type WorkingHoursRange = {
  start: string;
  end: string;
};

export type WorkingHoursDay = {
  id: string;
  weekday: number;
  label: string;
  closed: boolean;
  special: boolean;
  holiday: boolean;
  ranges: WorkingHoursRange[];
};

export type PublicBusiness = {
  name: string;
  tagline?: string;
  shortDescription?: string;
  about?: string;
  fieldOfActivity?: string;
  visitInfo?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  directionsUrl?: string;
  timezone?: string;
  currency?: string;
  socialLinks: PublicSocialLink[];
  bookingEnabled: boolean;
  providerPresentationEnabled: boolean;
  branchesEnabled: boolean;
  workingHours: WorkingHoursDay[];
  contactHours: WorkingHoursDay[];
};

export type PublicService = {
  id: string;
  name: string;
  shortDescription?: string;
  imageUrl?: string;
  durationMinutes?: number;
  priceLabel?: string;
};

export type PublicProvider = {
  id: string;
  name: string;
  title?: string;
  imageUrl?: string;
  relatedServiceNames: string[];
  availabilitySummary?: string;
};

export type PublicBranch = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  workingHours: WorkingHoursDay[];
};

export type PublicHomeData = {
  business: PublicBusiness;
  services: PublicService[] | { error: { message: string; requestId?: string } };
  providers: PublicProvider[] | { error: { message: string; requestId?: string } };
  branches: PublicBranch[] | { error: { message: string; requestId?: string } };
};
