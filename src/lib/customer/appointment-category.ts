import { APPOINTMENT_CATEGORIES, type AppointmentCategory } from "@/types/appointment-list";

export function parseAppointmentCategory(value: string | null | undefined): AppointmentCategory {
  const raw = value?.trim().toLowerCase();
  if (raw && (APPOINTMENT_CATEGORIES as string[]).includes(raw)) {
    return raw as AppointmentCategory;
  }
  return "upcoming";
}

export function parseAppointmentPage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function appointmentsHref(input: {
  category?: AppointmentCategory;
  page?: number;
}): string {
  const params = new URLSearchParams();
  params.set("category", input.category ?? "upcoming");
  if (input.page && input.page > 1) {
    params.set("page", String(input.page));
  }
  const query = params.toString();
  return query ? `/appointments?${query}` : "/appointments";
}
