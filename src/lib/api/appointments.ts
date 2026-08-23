import { apiClient } from "@/lib/api/client";
import { adaptAppointmentList } from "@/lib/customer/appointment-adapter";
import {
  adaptCustomerAppointmentDetail,
  adaptCustomerTimeline,
} from "@/lib/customer/appointment-detail-adapter";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
import type { QueryClient } from "@tanstack/react-query";
import type { AppointmentCategory, AppointmentListView } from "@/types/appointment-list";
import { APPOINTMENT_LIST_LIMIT } from "@/types/appointment-list";
import type {
  CustomerAppointmentDetailView,
  CustomerTimelineEvent,
} from "@/types/appointment-detail";

export async function fetchCustomerAppointments(
  input: {
    category: AppointmentCategory;
    page?: number;
    cursor?: string;
    limit?: number;
  },
  signal?: AbortSignal,
): Promise<AppointmentListView> {
  const params = new URLSearchParams();
  params.set("category", input.category);
  params.set("page", String(input.page && input.page > 0 ? input.page : 1));
  params.set("limit", String(input.limit ?? APPOINTMENT_LIST_LIMIT));
  if (input.cursor) {
    params.set("cursor", input.cursor);
  }
  const payload = await apiClient<unknown>(`/customer/appointments?${params.toString()}`, {
    method: "GET",
    signal,
  });
  return adaptAppointmentList(payload, input.category, input.page ?? 1);
}

export function customerAppointmentListQueryOptions(
  userId: string,
  category: AppointmentCategory,
  pagination: { page: number; cursor?: string } = { page: 1 },
) {
  return {
    queryKey: queryKeys.customer.appointmentList(userId, category, pagination),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchCustomerAppointments(
        {
          category,
          page: pagination.page,
          cursor: pagination.cursor,
        },
        signal,
      ),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export async function fetchCustomerAppointmentDetail(
  reference: string,
  signal?: AbortSignal,
): Promise<CustomerAppointmentDetailView> {
  const payload = await apiClient<unknown>(`/customer/appointments/${encodeURIComponent(reference)}`, {
    method: "GET",
    signal,
  });
  const view = adaptCustomerAppointmentDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "APPOINTMENT_NOT_FOUND",
      message: "نوبت پیدا نشد.",
    });
  }
  return view;
}

export async function fetchCustomerAppointmentTimeline(
  reference: string,
  signal?: AbortSignal,
): Promise<CustomerTimelineEvent[]> {
  try {
    const payload = await apiClient<unknown>(
      `/customer/appointments/${encodeURIComponent(reference)}/timeline`,
      {
        method: "GET",
        signal,
      },
    );
    return adaptCustomerTimeline(payload);
  } catch (error) {
    const normalized = toAppApiError(error);
    if (isNotFoundError(normalized)) {
      return [];
    }
    throw error;
  }
}

export function customerAppointmentDetailQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.customer.appointmentDetail(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchCustomerAppointmentDetail(reference, signal),
    enabled: Boolean(userId) && isSafePublicId(reference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export function customerAppointmentTimelineQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.customer.appointmentTimeline(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchCustomerAppointmentTimeline(reference, signal),
    enabled: Boolean(userId) && isSafePublicId(reference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export function invalidateCustomerAppointmentDetail(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.customer.appointmentDetail(userId, reference),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.customer.appointmentTimeline(userId, reference),
  });
  void queryClient.invalidateQueries({ queryKey: queryKeys.customer.appointments(userId) });
}
