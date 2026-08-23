import { asSafeText } from "@/lib/public/read";
import type { AdditionalFieldDefinition } from "@/types/booking";
import type { EligibleProvidersView, ProviderPreference } from "@/types/provider";

export function providerPresentation(
  preference: ProviderPreference,
  eligible?: EligibleProvidersView,
): { label: string; title?: string } | null {
  if (preference.type === "not_applicable") {
    return null;
  }
  if (preference.type === "automatic") {
    return { label: eligible?.assignmentLabel ?? "تخصیص توسط مجموعه" };
  }
  if (preference.type === "any") {
    return { label: "فرقی ندارد" };
  }
  const provider = eligible?.providers.find((item) => item.id === preference.providerId);
  if (!provider?.name) {
    return { label: "متخصص انتخاب‌شده" };
  }
  return { label: provider.name, title: provider.publicTitle };
}

export function formatAdditionalAnswer(
  field: AdditionalFieldDefinition,
  value: string | boolean | undefined,
): string | null {
  if (value === undefined || value === "") {
    return null;
  }
  if (field.type === "checkbox") {
    return value === true ? "بله" : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const safe = asSafeText(value);
  if (!safe) {
    return null;
  }
  if (field.type === "select" || field.type === "radio") {
    return field.options.find((option) => option.value === safe)?.label ?? safe;
  }
  if (field.sensitive) {
    return "••••";
  }
  return safe;
}

export function weekdayAndDateLabel(isoDate: string, timeZone?: string): { weekday: string; date: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null;
  }
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    const weekday = new Intl.DateTimeFormat("fa-IR", {
      weekday: "long",
      timeZone: timeZone || undefined,
      calendar: "gregory",
    }).format(date);
    const formatted = new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeZone: timeZone || undefined,
      calendar: "gregory",
    }).format(date);
    return { weekday, date: formatted };
  } catch {
    return { weekday: "", date: isoDate };
  }
}
