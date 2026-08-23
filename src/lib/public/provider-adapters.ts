import { isRecord, readString } from "@/lib/utilities/records";
import {
  asList,
  asSafeText,
  readBoolean,
  readUrl,
  unwrapPayload,
} from "@/lib/public/read";
import {
  isExplicitlyInactive,
  isExplicitlyPrivate,
  isInternalResource,
  readId,
} from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import type { PublicProvider } from "@/types/public";
import type {
  EligibleProvidersView,
  ProviderSelectionMode,
  PublicProviderView,
} from "@/types/provider";

const MODE_ALIASES: Record<string, ProviderSelectionMode> = {
  not_applicable: "not_applicable",
  notapplicable: "not_applicable",
  none: "not_applicable",
  hidden: "not_applicable",
  automatic: "automatic",
  auto: "automatic",
  assigned: "automatic",
  system: "automatic",
  optional: "optional",
  elective: "optional",
  required: "required",
  mandatory: "required",
};

function readNames(value: unknown): string[] {
  return asList(value, ["items", "names", "services", "branches"])
    .map((item) =>
      typeof item === "string"
        ? asSafeText(item)
        : isRecord(item)
          ? asSafeText(item.name) ?? asSafeText(item.title)
          : undefined,
    )
    .filter((item): item is string => Boolean(item));
}

export function adaptPublicProviderView(value: unknown): PublicProviderView | null {
  if (!isRecord(value)) {
    return null;
  }
  if (isExplicitlyInactive(value) || isExplicitlyPrivate(value) || isInternalResource(value)) {
    return null;
  }
  const id = readId(value);
  const name =
    asSafeText(value.name) ??
    asSafeText(value.displayName) ??
    asSafeText(value.publicName) ??
    asSafeText(value.fullName);
  if (!id || !name) {
    return null;
  }

  const view: PublicProviderView = {
    id,
    name,
    relatedServiceNames: readNames(value.relatedServiceNames ?? value.services ?? value.relatedServices),
    branchNames: readNames(value.branchNames ?? value.branches ?? value.publicBranches),
  };

  const imageUrl = readUrl(value.imageUrl ?? value.photoUrl ?? value.avatarUrl ?? value.publicImageUrl);
  if (imageUrl) {
    view.imageUrl = imageUrl;
  }
  const publicTitle =
    asSafeText(value.publicTitle) ??
    asSafeText(value.title) ??
    asSafeText(value.role);
  if (publicTitle) {
    view.publicTitle = publicTitle;
  }
  const specialty = asSafeText(value.specialty) ?? asSafeText(value.publicSpecialty);
  if (specialty && specialty !== publicTitle) {
    view.specialty = specialty;
  }
  const shortBio = asSafeText(value.shortBio) ?? asSafeText(value.bio) ?? asSafeText(value.publicBio);
  if (shortBio) {
    view.shortBio = shortBio;
  }
  const availabilitySummary =
    asSafeText(value.availabilitySummary) ?? asSafeText(value.publicAvailability);
  if (availabilitySummary) {
    view.availabilitySummary = availabilitySummary;
  }

  return view;
}

export function adaptPublicProviderViews(payload: unknown): PublicProviderView[] {
  return asList(unwrapPayload(payload), ["providers", "staff", "items", "results"])
    .map(adaptPublicProviderView)
    .filter((item): item is PublicProviderView => Boolean(item));
}

export function toPublicProvider(view: PublicProviderView): PublicProvider {
  return {
    id: view.id,
    name: view.name,
    title: view.publicTitle ?? view.specialty,
    imageUrl: view.imageUrl,
    relatedServiceNames: view.relatedServiceNames,
    availabilitySummary: view.availabilitySummary,
  };
}

export function viewFromPublicProvider(provider: PublicProvider): PublicProviderView {
  return {
    id: provider.id,
    name: provider.name,
    imageUrl: provider.imageUrl,
    publicTitle: provider.title,
    relatedServiceNames: provider.relatedServiceNames,
    branchNames: [],
    availabilitySummary: provider.availabilitySummary,
  };
}

export function adaptProviderSelectionMode(value: unknown): ProviderSelectionMode | undefined {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) {
    return undefined;
  }
  return MODE_ALIASES[raw] ?? MODE_ALIASES[raw.replace(/_/g, "")];
}

export function adaptEligibleProviders(payload: unknown): EligibleProvidersView {
  const root = unwrapPayload(payload);
  const providers = adaptPublicProviderViews(root);
  const source = isRecord(root) ? root : {};
  const mode = adaptProviderSelectionMode(
    source.selectionMode ?? source.providerSelectionMode ?? source.mode,
  );

  const anyFlag = readBoolean(source.anyAvailableAllowed) ?? readBoolean(source.allowAnyProvider);
  const assignmentLabel =
    asSafeText(source.assignmentLabel) ?? asSafeText(source.automaticAssignmentLabel);

  const resolvedMode = mode ?? "not_applicable";
  const anyAvailableAllowed =
    anyFlag ?? (resolvedMode === "optional");

  const result: EligibleProvidersView = {
    mode: resolvedMode,
    anyAvailableAllowed: resolvedMode === "optional" ? true : Boolean(anyAvailableAllowed),
    providers,
  };
  if (resolvedMode === "automatic") {
    result.assignmentLabel = assignmentLabel ?? "تخصیص توسط مجموعه";
  }
  return result;
}

export function isEligibleProviderId(id: string, providers: PublicProviderView[]): boolean {
  return isSafePublicId(id) && providers.some((item) => item.id === id);
}
