import { cache } from "react";
import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, isPublicApiDisconnected, toAppApiError } from "@/lib/api/errors";
import {
  adaptPublicBranches,
  adaptPublicBusiness,
  adaptPublicProviders,
  adaptPublicServices,
  configuredPublicBusiness,
} from "@/lib/public/adapters";
import {
  adaptServiceCatalog,
  adaptServiceDetail,
  relatedBranchesFromPayload,
  relatedProvidersFromPayload,
} from "@/lib/public/service-adapters";
import { isRecord } from "@/lib/utilities/records";
import { unwrapPayload } from "@/lib/public/read";
import { isSafePublicId } from "@/lib/public/booking-href";
import type { AppApiError } from "@/types/api";
import type {
  PublicBranch,
  PublicBusiness,
  PublicProvider,
  PublicService,
} from "@/types/public";
import type { ServiceCatalogView, ServiceDetailView, ServiceFilters } from "@/types/service";

export type LoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppApiError };

async function load<T>(task: () => Promise<T>): Promise<LoadResult<T>> {
  try {
    return { ok: true, data: await task() };
  } catch (error) {
    return { ok: false, error: toAppApiError(error) };
  }
}

export async function fetchPublicBusiness(signal?: AbortSignal): Promise<PublicBusiness> {
  const payload = await apiClient<unknown>("/public/business", {
    method: "GET",
    signal,
  });
  const business = adaptPublicBusiness(payload);
  if (!business) {
    throw new ApiError({
      status: 404,
      code: "PUBLIC_BUSINESS_UNAVAILABLE",
      message: "اطلاعات این مجموعه در دسترس نیست.",
    });
  }
  return business;
}

export const getPublicBusiness = cache(async () => fetchPublicBusiness());

/**
 * The Backend catalog is `GET /services` (requires `services.read`, so anonymous
 * visitors receive 401). Only active services are listed; 100 is the Backend's
 * maximum page size.
 */
const SERVICE_CATALOG_QUERY = { status: "active", page: 1, page_size: 100 } as const;

function serviceDetailPath(serviceId: string): string {
  return `/services/${encodeURIComponent(serviceId)}`;
}

const getPublicServicesPayload = cache(async () => {
  return apiClient<unknown>("/services", { method: "GET", query: SERVICE_CATALOG_QUERY });
});

export const getPublicServices = cache(async (currency?: string): Promise<PublicService[]> => {
  const payload = await getPublicServicesPayload();
  return adaptPublicServices(payload, currency);
});

export async function fetchPublicServiceCatalog(
  currency?: string,
  filters: ServiceFilters = {},
  signal?: AbortSignal,
): Promise<ServiceCatalogView> {
  const payload = await apiClient<unknown>("/services", {
    method: "GET",
    signal,
    query: {
      ...SERVICE_CATALOG_QUERY,
      search: filters.q,
    },
  });
  return adaptServiceCatalog(payload, currency);
}

export const getPublicServiceCatalog = cache(async (currency?: string, filters?: ServiceFilters) => {
  const resolved = filters ?? {};
  if (!resolved.q && !resolved.category) {
    const payload = await getPublicServicesPayload();
    return adaptServiceCatalog(payload, currency);
  }
  return fetchPublicServiceCatalog(currency, resolved);
});

export function isSafeServiceParam(value: string): boolean {
  if (!value || value.length > 80 || value.includes("/") || value.includes(".")) {
    return false;
  }
  if (isSafePublicId(value)) {
    return true;
  }
  return /^[\p{L}\p{N}_-]+$/u.test(value);
}

export async function fetchPublicServiceDetail(
  serviceId: string,
  currency?: string,
  signal?: AbortSignal,
): Promise<ServiceDetailView> {
  const payload = await apiClient<unknown>(serviceDetailPath(serviceId), { method: "GET", signal });
  const detail = adaptServiceDetail(payload, currency);
  if (!detail) {
    throw new ApiError({
      status: 404,
      code: "SERVICE_NOT_FOUND",
      message: "این خدمت پیدا نشد.",
    });
  }
  return detail;
}

export const getPublicServiceDetail = cache(async (serviceId: string, currency?: string) => {
  return fetchPublicServiceDetail(serviceId, currency);
});

export async function fetchServiceProviders(
  serviceId: string,
  signal?: AbortSignal,
): Promise<PublicProvider[]> {
  const payload = await apiClient<unknown>(
    `/public/services/${encodeURIComponent(serviceId)}/providers`,
    { method: "GET", signal },
  );
  return adaptPublicProviders(payload);
}

export async function fetchServiceBranches(
  serviceId: string,
  signal?: AbortSignal,
): Promise<PublicBranch[]> {
  const payload = await apiClient<unknown>(
    `/public/services/${encodeURIComponent(serviceId)}/branches`,
    { method: "GET", signal },
  );
  return adaptPublicBranches(payload);
}

async function optionalRelated<T>(task: () => Promise<T>, fallback: T): Promise<LoadResult<T>> {
  try {
    return { ok: true, data: await task() };
  } catch (error) {
    const normalized = toAppApiError(error);
    if (isNotFoundError(normalized)) {
      return { ok: true, data: fallback };
    }
    return { ok: false, error: normalized };
  }
}

export type ServiceDetailPageData = {
  service: ServiceDetailView;
  providers: LoadResult<PublicProvider[]>;
  branches: LoadResult<PublicBranch[]>;
  rawIncludesRelated: boolean;
};

export const loadServiceDetailPage = cache(async (
  serviceId: string,
  options: { currency?: string; loadProviders: boolean; loadBranches: boolean },
): Promise<ServiceDetailPageData> => {
  const payload = await apiClient<unknown>(serviceDetailPath(serviceId), { method: "GET" });
  const service = adaptServiceDetail(payload, options.currency);
  if (!service) {
    throw new ApiError({
      status: 404,
      code: "SERVICE_NOT_FOUND",
      message: "این خدمت پیدا نشد.",
    });
  }

  const nestedProviders = relatedProvidersFromPayload(payload);
  const nestedBranches = relatedBranchesFromPayload(payload);
  const root = unwrapPayload(payload);
  const hasNestedProviders =
    isRecord(root) && (root.providers !== undefined || root.relatedProviders !== undefined);
  const hasNestedBranches =
    isRecord(root) && (root.branches !== undefined || root.relatedBranches !== undefined);

  const providers = hasNestedProviders
    ? { ok: true as const, data: nestedProviders }
    : options.loadProviders
      ? await optionalRelated(() => fetchServiceProviders(service.id), [])
      : { ok: true as const, data: [] as PublicProvider[] };

  const branches = hasNestedBranches
    ? { ok: true as const, data: nestedBranches }
    : options.loadBranches
      ? await optionalRelated(() => fetchServiceBranches(service.id), [])
      : { ok: true as const, data: [] as PublicBranch[] };

  return {
    service,
    providers,
    branches,
    rawIncludesRelated: hasNestedProviders || hasNestedBranches,
  };
});

export const getPublicProviders = cache(async (): Promise<PublicProvider[]> => {
  const payload = await apiClient<unknown>("/public/providers", { method: "GET" });
  return adaptPublicProviders(payload);
});

export const getPublicBranches = cache(async (): Promise<PublicBranch[]> => {
  const payload = await apiClient<unknown>("/public/branches", { method: "GET" });
  return adaptPublicBranches(payload);
});

export async function fetchPublicBranches(signal?: AbortSignal): Promise<PublicBranch[]> {
  const payload = await apiClient<unknown>("/public/branches", {
    method: "GET",
    signal,
  });
  return adaptPublicBranches(payload);
}

export async function fetchPublicProviders(signal?: AbortSignal): Promise<PublicProvider[]> {
  const payload = await apiClient<unknown>("/public/providers", {
    method: "GET",
    signal,
  });
  return adaptPublicProviders(payload);
}

export const loadPublicBusiness = cache(async () => load(getPublicBusiness));

export const loadPublicServiceCatalog = cache(async (currency?: string, filters?: ServiceFilters) =>
  load(() => getPublicServiceCatalog(currency, filters)),
);

export async function loadPublicHome() {
  const businessResult = await loadPublicBusiness();
  if (!businessResult.ok) {
    if (isPublicApiDisconnected(businessResult.error)) {
      // The catalog has its own Backend endpoint, so a failure there must not read as "no services".
      const services =
        businessResult.error.code === "MISSING_API_BASE_URL"
          ? { ok: true as const, data: [] as PublicService[] }
          : await load(() => getPublicServices());
      return {
        business: { ok: true as const, data: configuredPublicBusiness() },
        services,
        providers: { ok: true as const, data: [] as PublicProvider[] },
        branches: { ok: true as const, data: [] as PublicBranch[] },
      };
    }
    return { business: businessResult };
  }

  const business = businessResult.data;
  const [services, providers, branches] = await Promise.all([
    load(() => getPublicServices(business.currency)),
    business.providerPresentationEnabled
      ? load(getPublicProviders)
      : Promise.resolve({ ok: true, data: [] as PublicProvider[] } as const),
    business.branchesEnabled
      ? load(getPublicBranches)
      : Promise.resolve({ ok: true, data: [] as PublicBranch[] } as const),
  ]);

  return {
    business: businessResult,
    services,
    providers,
    branches,
  };
}

/**
 * Booking Wizard must call this (or an equivalent) before creating a booking.
 * URL `service` is initial intent only.
 */
export async function revalidateBookableService(
  serviceId: string,
  currency?: string,
  signal?: AbortSignal,
): Promise<ServiceDetailView> {
  return fetchPublicServiceDetail(serviceId, currency, signal);
}
