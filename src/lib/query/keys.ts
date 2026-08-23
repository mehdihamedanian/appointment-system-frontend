export const queryKeys = {
  session: ["session"] as const,
  capabilities: ["capabilities"] as const,
  publicBusiness: ["public", "business"] as const,
  publicServices: ["public", "services"] as const,
  publicProviders: ["public", "providers"] as const,
  publicBranches: ["public", "branches"] as const,
  customer: {
    dashboard: (userId: string) => ["customer", "dashboard", userId] as const,
    appointments: (userId: string) => ["customer", "appointments", userId] as const,
    appointmentList: (
      userId: string,
      category: string,
      pagination: { page: number; cursor?: string } = { page: 1 },
    ) =>
      [
        "customer",
        "appointments",
        userId,
        "list",
        category,
        pagination.page,
        pagination.cursor ?? "",
      ] as const,
    appointmentDetail: (userId: string, appointmentId: string) =>
      ["customer", "appointments", userId, "detail", appointmentId] as const,
    appointmentTimeline: (userId: string, appointmentId: string) =>
      ["customer", "appointments", userId, "timeline", appointmentId] as const,
    appointmentCancellationPreview: (userId: string, appointmentId: string) =>
      ["customer", "appointments", userId, "cancellation-preview", appointmentId] as const,
    appointmentReschedulePreview: (userId: string, appointmentId: string) =>
      ["customer", "appointments", userId, "reschedule-preview", appointmentId] as const,
    appointmentReview: (userId: string, appointmentId: string) =>
      ["customer", "appointments", userId, "review", appointmentId] as const,
    appointmentRescheduleQuote: (
      userId: string,
      appointmentId: string,
      input: {
        slotId: string;
        date: string;
        branchId?: string;
        providerId?: string;
        previewVersion?: string;
      } | null,
    ) =>
      [
        "customer",
        "appointments",
        userId,
        "reschedule-quote",
        appointmentId,
        input?.slotId ?? "",
        input?.date ?? "",
        input?.branchId ?? "",
        input?.providerId ?? "",
        input?.previewVersion ?? "",
      ] as const,
    payments: (userId: string) => ["customer", "payments", userId] as const,
    paymentList: (
      userId: string,
      filters: {
        status: string;
        q?: string;
        appointmentId?: string;
        from?: string;
        to?: string;
        page: number;
      },
    ) =>
      [
        "customer",
        "payments",
        userId,
        "list",
        filters.status,
        filters.q ?? "",
        filters.appointmentId ?? "",
        filters.from ?? "",
        filters.to ?? "",
        filters.page,
      ] as const,
    paymentDetail: (userId: string, reference: string) =>
      ["customer", "payments", userId, "detail", reference] as const,
    notifications: (userId: string) => ["customer", "notifications", userId] as const,
    notificationList: (
      userId: string,
      input: { page: number; read: string },
    ) =>
      ["customer", "notifications", userId, "list", input.read, input.page] as const,
    notificationRecent: (userId: string) =>
      ["customer", "notifications", userId, "recent"] as const,
    notificationUnreadCount: (userId: string) =>
      ["customer", "notifications", userId, "unread-count"] as const,
    notificationDetail: (userId: string, id: string) =>
      ["customer", "notifications", userId, "detail", id] as const,
    waitingList: (userId: string) => ["customer", "waiting-list", userId] as const,
    waitingListEntries: (userId: string, pagination: { page: number } = { page: 1 }) =>
      ["customer", "waiting-list", userId, "list", pagination.page] as const,
    waitingListEntry: (userId: string, reference: string) =>
      ["customer", "waiting-list", userId, "entry", reference] as const,
    waitingListOffer: (userId: string, reference: string) =>
      ["customer", "waiting-list", userId, "offer", reference] as const,
    waitingListEligibility: (
      userId: string,
      input: {
        serviceId: string;
        branchId?: string;
        preference?: { type: string; providerId?: string };
        date?: string;
      },
    ) =>
      [
        "customer",
        "waiting-list",
        userId,
        "eligibility",
        input.serviceId,
        input.branchId ?? "",
        input.preference?.type ?? "",
        input.preference?.type === "specific" ? input.preference.providerId ?? "" : "",
        input.date ?? "",
      ] as const,
    profile: (userId: string) => ["customer", "profile", userId] as const,
    notificationPreferences: (userId: string) =>
      ["customer", "profile", userId, "notifications"] as const,
  },
  services: {
    list: (filters: { q?: string; category?: string } = {}) =>
      ["public", "services", "list", filters] as const,
    detail: (serviceId: string) => ["public", "services", "detail", serviceId] as const,
    providers: (serviceId: string) =>
      ["public", "services", "providers", serviceId] as const,
    branches: (serviceId: string) =>
      ["public", "services", "branches", serviceId] as const,
  },
  providers: {
    byService: (serviceId: string, branchId?: string) =>
      ["public", "providers", "eligible", serviceId, branchId ?? ""] as const,
  },
  booking: {
    dates: (
      serviceId: string,
      branchId: string | undefined,
      preference: { type: string; providerId?: string },
      month?: string,
    ) => queryKeys.availability.dates(serviceId, branchId, preference, month ?? ""),
    slots: (
      serviceId: string,
      branchId: string | undefined,
      preference: { type: string; providerId?: string },
      date: string,
    ) => queryKeys.availability.slots(serviceId, branchId, preference, date),
    quote: (fingerprint: string) => ["booking", "quote", fingerprint] as const,
    confirm: (fingerprint: string) => ["booking", "confirm", fingerprint] as const,
    confirmation: (reference: string) => ["booking", "confirmation", reference] as const,
    hold: (holdReference: string) => ["booking", "hold", holdReference] as const,
    payment: (paymentReference: string) => ["booking", "payment", paymentReference] as const,
  },
  availability: {
    all: ["availability"] as const,
    dates: (
      serviceId: string,
      branchId: string | undefined,
      preference: { type: string; providerId?: string },
      month: string,
    ) =>
      [
        "availability",
        "dates",
        serviceId,
        branchId ?? "",
        preference.type,
        preference.type === "specific" ? preference.providerId ?? "" : "",
        month,
      ] as const,
    slots: (
      serviceId: string,
      branchId: string | undefined,
      preference: { type: string; providerId?: string },
      date: string,
    ) =>
      [
        "availability",
        "slots",
        serviceId,
        branchId ?? "",
        preference.type,
        preference.type === "specific" ? preference.providerId ?? "" : "",
        date,
      ] as const,
  },
  reschedule: {
    all: ["reschedule", "availability"] as const,
    dates: (
      reference: string,
      branchId: string | undefined,
      preference: { type: string; providerId?: string },
      month: string,
    ) =>
      [
        "reschedule",
        "availability",
        "dates",
        reference,
        branchId ?? "",
        preference.type,
        preference.type === "specific" ? preference.providerId ?? "" : "",
        month,
      ] as const,
    slots: (
      reference: string,
      branchId: string | undefined,
      preference: { type: string; providerId?: string },
      date: string,
    ) =>
      [
        "reschedule",
        "availability",
        "slots",
        reference,
        branchId ?? "",
        preference.type,
        preference.type === "specific" ? preference.providerId ?? "" : "",
        date,
      ] as const,
  },
} as const;
