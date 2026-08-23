export type ProviderSelectionMode =
  | "not_applicable"
  | "automatic"
  | "optional"
  | "required";

export type ProviderPreference =
  | { type: "specific"; providerId: string }
  | { type: "any" }
  | { type: "automatic" }
  | { type: "not_applicable" };

export type ProviderSelectionNotice =
  | "removed"
  | "unavailable_service"
  | "unavailable_branch";

export type PublicProviderView = {
  id: string;
  name: string;
  imageUrl?: string;
  publicTitle?: string;
  specialty?: string;
  shortBio?: string;
  relatedServiceNames: string[];
  branchNames: string[];
  availabilitySummary?: string;
};

export type EligibleProvidersView = {
  mode: ProviderSelectionMode;
  anyAvailableAllowed: boolean;
  assignmentLabel?: string;
  providers: PublicProviderView[];
};
