import { isSafePublicId } from "@/lib/public/booking-href";
import { validateProviderPreference } from "@/lib/public/provider-preference";
import type { EligibleProvidersView } from "@/types/provider";
import type {
  AdditionalFieldDefinition,
  BookingDraft,
  BookingStepId,
} from "@/types/booking";

export function isValidIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function validateAdditionalFields(
  fields: AdditionalFieldDefinition[],
  values: BookingDraft["additionalData"],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = values[field.id];
    if (field.required) {
      if (field.type === "checkbox") {
        if (value !== true) {
          errors[field.id] = `${field.label} الزامی است.`;
        }
      } else if (typeof value !== "string" || !value.trim()) {
        errors[field.id] = `${field.label} الزامی است.`;
      }
    }
    if (typeof value === "string") {
      if (field.minLength && value.length < field.minLength) {
        errors[field.id] = `${field.label} کوتاه است.`;
      }
      if (field.maxLength && value.length > field.maxLength) {
        errors[field.id] = `${field.label} بیش از حد مجاز است.`;
      }
      if (field.pattern) {
        try {
          if (value && !new RegExp(field.pattern).test(value)) {
            errors[field.id] = `${field.label} معتبر نیست.`;
          }
        } catch {
          // Ignore invalid backend patterns rather than throwing.
        }
      }
    }
  }
  return errors;
}

export function isStepValid(
  step: BookingStepId,
  draft: BookingDraft,
  context: {
    eligible?: EligibleProvidersView;
    additionalFields?: AdditionalFieldDefinition[];
    requiresBranch: boolean;
  },
): boolean {
  switch (step) {
    case "service":
      return Boolean(draft.serviceId && isSafePublicId(draft.serviceId));
    case "branch":
      return Boolean(draft.branchId && isSafePublicId(draft.branchId));
    case "provider":
      if (!context.eligible) {
        return false;
      }
      return !validateProviderPreference(
        context.eligible.mode,
        draft.providerPreference,
        context.eligible,
      );
    case "date":
      return isValidIsoDate(draft.date);
    case "time":
      return Boolean(draft.slotId && isSafePublicId(draft.slotId));
    case "details": {
      const fields = context.additionalFields ?? [];
      return Object.keys(validateAdditionalFields(fields, draft.additionalData)).length === 0;
    }
    case "summary":
      return (
        isStepValid("service", draft, context) &&
        (!context.requiresBranch || isStepValid("branch", draft, context)) &&
        isStepValid("date", draft, context) &&
        isStepValid("time", draft, context)
      );
    case "checkout":
      return isStepValid("summary", draft, context);
    default:
      return false;
  }
}
