import { isSafePublicId } from "@/lib/public/booking-href";
import type { ServiceCatalogView, ServiceFilters, ServiceListItemView } from "@/types/service";

export const SERVICE_SEARCH_MAX_LENGTH = 80;

export function sanitizeServiceQuery(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, SERVICE_SEARCH_MAX_LENGTH);
  return cleaned || undefined;
}

export function sanitizeCategoryParam(
  value: string | null | undefined,
  allowedIds: string[],
): string | undefined {
  if (!value || !isSafePublicId(value)) {
    return undefined;
  }
  return allowedIds.includes(value) ? value : undefined;
}

export function catalogCategories(items: ServiceListItemView[]): Array<{ id: string; name: string }> {
  const seen = new Map<string, string>();
  for (const item of items) {
    if (item.category && !seen.has(item.category.id)) {
      seen.set(item.category.id, item.category.name);
    }
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}

export function filterServiceCatalog(
  catalog: ServiceCatalogView,
  filters: ServiceFilters,
): ServiceListItemView[] {
  if (catalog.paginated) {
    return catalog.items;
  }

  const query = sanitizeServiceQuery(filters.q)?.toLowerCase();
  const category = filters.category;

  return catalog.items.filter((item) => {
    if (category && item.category?.id !== category) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystack = [item.name, item.shortDescription, item.category?.name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}
