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
  admin: {
    dashboard: (
      userId: string,
      filters: {
        date: string;
        analyticsFrom?: string;
        analyticsTo?: string;
        branchId?: string;
      },
    ) =>
      [
        "admin",
        "dashboard",
        userId,
        filters.date,
        filters.analyticsFrom ?? "",
        filters.analyticsTo ?? "",
        filters.branchId ?? "",
      ] as const,
    appointmentList: (
      userId: string,
      filters: {
        q?: string;
        date?: string;
        from?: string;
        to?: string;
        status: string;
        paymentStatus: string;
        serviceId?: string;
        staffId?: string;
        resourceId?: string;
        customerId?: string;
        branchId?: string;
        bookingSource?: string;
        sort: string;
        direction: string;
        page: number;
      },
    ) =>
      [
        "admin",
        "appointments",
        userId,
        "list",
        filters.q ?? "",
        filters.date ?? "",
        filters.from ?? "",
        filters.to ?? "",
        filters.status,
        filters.paymentStatus,
        filters.serviceId ?? "",
        filters.staffId ?? "",
        filters.resourceId ?? "",
        filters.customerId ?? "",
        filters.branchId ?? "",
        filters.bookingSource ?? "",
        filters.sort,
        filters.direction,
        filters.page,
      ] as const,
    appointmentDetail: (userId: string, reference: string) =>
      ["admin", "appointments", userId, "detail", reference] as const,
    appointmentTimeline: (userId: string, reference: string) =>
      ["admin", "appointments", userId, "timeline", reference] as const,
    appointmentCancellationPreview: (userId: string, reference: string) =>
      ["admin", "appointments", userId, "cancellation-preview", reference] as const,
    manualBookingCustomerSearch: (userId: string, query: string) =>
      ["admin", "manual-booking", userId, "customer-search", query] as const,
    manualBookingOptions: (userId: string) =>
      ["admin", "manual-booking", userId, "options"] as const,
    manualBookingDates: (
      customerId: string,
      serviceId: string,
      branchId: string | undefined,
      preference: { type: string; providerId?: string },
      month: string,
    ) =>
      [
        "admin",
        "manual-booking",
        "dates",
        customerId,
        serviceId,
        branchId ?? "",
        preference.type,
        preference.type === "specific" ? preference.providerId ?? "" : "",
        month,
      ] as const,
    manualBookingSlots: (
      customerId: string,
      serviceId: string,
      branchId: string | undefined,
      preference: { type: string; providerId?: string },
      date: string,
    ) =>
      [
        "admin",
        "manual-booking",
        "slots",
        customerId,
        serviceId,
        branchId ?? "",
        preference.type,
        preference.type === "specific" ? preference.providerId ?? "" : "",
        date,
      ] as const,
    manualBookingAllocation: (userId: string, fingerprint: string) =>
      ["admin", "manual-booking", userId, "allocation", fingerprint] as const,
    manualBookingQuote: (userId: string, fingerprint: string) =>
      ["admin", "manual-booking", userId, "quote", fingerprint] as const,
    calendar: (
      userId: string,
      filters: {
        from: string;
        to: string;
        range: string;
        grouping: string;
        timezone: string;
        branchId?: string;
        staffId?: string;
        resourceId?: string;
        resourceType?: string;
        serviceId?: string;
        status: string;
        paymentStatus: string;
      },
    ) =>
      [
        "admin",
        "calendar",
        userId,
        filters.from,
        filters.to,
        filters.range,
        filters.grouping,
        filters.timezone,
        filters.branchId ?? "",
        filters.staffId ?? "",
        filters.resourceId ?? "",
        filters.resourceType ?? "",
        filters.serviceId ?? "",
        filters.status,
        filters.paymentStatus,
      ] as const,
    resourceList: (
      userId: string,
      filters: {
        q?: string;
        type: string;
        branchId?: string;
        serviceId?: string;
        active: string;
        sort: string;
        direction: string;
        page: number;
      },
    ) =>
      [
        "admin",
        "resources",
        userId,
        "list",
        filters.q ?? "",
        filters.type,
        filters.branchId ?? "",
        filters.serviceId ?? "",
        filters.active,
        filters.sort,
        filters.direction,
        filters.page,
      ] as const,
    resourceDetail: (userId: string, reference: string) =>
      ["admin", "resources", userId, "detail", reference] as const,
    staffList: (
      userId: string,
      filters: {
        q?: string;
        active: string;
        branchId?: string;
        serviceId?: string;
        jobTitle?: string;
        specialty?: string;
        customerVisible: string;
        bookable: string;
        sort: string;
        direction: string;
        page: number;
      },
    ) =>
      [
        "admin",
        "staff",
        userId,
        "list",
        filters.q ?? "",
        filters.active,
        filters.branchId ?? "",
        filters.serviceId ?? "",
        filters.jobTitle ?? "",
        filters.specialty ?? "",
        filters.customerVisible,
        filters.bookable,
        filters.sort,
        filters.direction,
        filters.page,
      ] as const,
    staffDetail: (userId: string, reference: string) =>
      ["admin", "staff", userId, "detail", reference] as const,
    staffPerformance: (userId: string, reference: string) =>
      ["admin", "staff", userId, "performance", reference] as const,
    serviceResourceRequirements: (userId: string, serviceReference: string) =>
      ["admin", "services", userId, "resource-requirements", serviceReference] as const,
    serviceList: (
      userId: string,
      filters: {
        q?: string;
        active: string;
        branchId?: string;
        providerId?: string;
        resourceType?: string;
        sort: string;
        direction: string;
        page: number;
      },
    ) =>
      [
        "admin",
        "services",
        userId,
        "list",
        filters.q ?? "",
        filters.active,
        filters.branchId ?? "",
        filters.providerId ?? "",
        filters.resourceType ?? "",
        filters.sort,
        filters.direction,
        filters.page,
      ] as const,
    serviceDetail: (userId: string, reference: string) =>
      ["admin", "services", userId, "detail", reference] as const,
    scheduleHub: (userId: string) => ["admin", "schedules", userId, "hub"] as const,
    scheduleDetail: (userId: string, scope: string, reference?: string) =>
      ["admin", "schedules", userId, "detail", scope, reference ?? ""] as const,
    scheduleHolidays: (userId: string) => ["admin", "schedules", userId, "holidays"] as const,
    branchList: (
      userId: string,
      filters: {
        q?: string;
        active: string;
        sort: string;
        direction: string;
        page: number;
      },
    ) =>
      [
        "admin",
        "branches",
        userId,
        "list",
        filters.q ?? "",
        filters.active,
        filters.sort,
        filters.direction,
        filters.page,
      ] as const,
    branchDetail: (userId: string, reference: string) =>
      ["admin", "branches", userId, "detail", reference] as const,
    customerList: (
      userId: string,
      filters: {
        q?: string;
        active: string;
        upcoming: string;
        lastVisitFrom?: string;
        lastVisitTo?: string;
        serviceId?: string;
        branchId?: string;
        tagId?: string;
        sort: string;
        direction: string;
        page: number;
      },
    ) =>
      [
        "admin",
        "customers",
        userId,
        "list",
        filters.q ?? "",
        filters.active,
        filters.upcoming,
        filters.lastVisitFrom ?? "",
        filters.lastVisitTo ?? "",
        filters.serviceId ?? "",
        filters.branchId ?? "",
        filters.tagId ?? "",
        filters.sort,
        filters.direction,
        filters.page,
      ] as const,
    customerDetail: (userId: string, reference: string) =>
      ["admin", "customers", userId, "detail", reference] as const,
    customerAppointments: (userId: string, reference: string, page: number) =>
      ["admin", "customers", userId, "appointments", reference, page] as const,
    customerPayments: (userId: string, reference: string, page: number) =>
      ["admin", "customers", userId, "payments", reference, page] as const,
    paymentList: (
      userId: string,
      filters: {
        q?: string;
        status: string;
        refundStatus: string;
        method: string;
        appointmentId?: string;
        customerId?: string;
        branchId?: string;
        from?: string;
        to?: string;
        sort: string;
        direction: string;
        page: number;
      },
    ) =>
      [
        "admin",
        "payments",
        userId,
        "list",
        filters.q ?? "",
        filters.status,
        filters.refundStatus,
        filters.method,
        filters.appointmentId ?? "",
        filters.customerId ?? "",
        filters.branchId ?? "",
        filters.from ?? "",
        filters.to ?? "",
        filters.sort,
        filters.direction,
        filters.page,
      ] as const,
    paymentDetail: (userId: string, reference: string) =>
      ["admin", "payments", userId, "detail", reference] as const,
    paymentRevenueSummary: (
      userId: string,
      filters: {
        q?: string;
        status: string;
        refundStatus: string;
        method: string;
        appointmentId?: string;
        customerId?: string;
        branchId?: string;
        from?: string;
        to?: string;
      },
    ) =>
      [
        "admin",
        "payments",
        userId,
        "revenue",
        filters.q ?? "",
        filters.status,
        filters.refundStatus,
        filters.method,
        filters.appointmentId ?? "",
        filters.customerId ?? "",
        filters.branchId ?? "",
        filters.from ?? "",
        filters.to ?? "",
      ] as const,
    couponList: (
      userId: string,
      filters: {
        q?: string;
        status: string;
        discountType: string;
        validity: string;
        serviceId?: string;
        branchId?: string;
        sort: string;
        direction: string;
        page: number;
      },
    ) =>
      [
        "admin",
        "coupons",
        userId,
        "list",
        filters.q ?? "",
        filters.status,
        filters.discountType,
        filters.validity,
        filters.serviceId ?? "",
        filters.branchId ?? "",
        filters.sort,
        filters.direction,
        filters.page,
      ] as const,
    couponDetail: (userId: string, reference: string) =>
      ["admin", "coupons", userId, "detail", reference] as const,
    waitingListList: (
      userId: string,
      filters: {
        q?: string;
        entryStatus: string;
        offerStatus: string;
        serviceId?: string;
        providerId?: string;
        branchId?: string;
        preferredFrom?: string;
        preferredTo?: string;
        createdFrom?: string;
        createdTo?: string;
        sort: string;
        direction: string;
        page: number;
      },
    ) =>
      [
        "admin",
        "waiting-list",
        userId,
        "list",
        filters.q ?? "",
        filters.entryStatus,
        filters.offerStatus,
        filters.serviceId ?? "",
        filters.providerId ?? "",
        filters.branchId ?? "",
        filters.preferredFrom ?? "",
        filters.preferredTo ?? "",
        filters.createdFrom ?? "",
        filters.createdTo ?? "",
        filters.sort,
        filters.direction,
        filters.page,
      ] as const,
    waitingListDetail: (userId: string, reference: string) =>
      ["admin", "waiting-list", userId, "detail", reference] as const,
    waitingListOfferEligibility: (userId: string, reference: string) =>
      ["admin", "waiting-list", userId, "offer-eligibility", reference] as const,
    waitingListAvailability: (userId: string, reference: string, date: string) =>
      ["admin", "waiting-list", userId, "availability", reference, date] as const,
    notificationTemplateList: (
      userId: string,
      filters: {
        q?: string;
        eventType: string;
        channel: string;
        language?: string;
        status: string;
        branchId?: string;
        sort: string;
        direction: string;
        page: number;
      },
    ) =>
      [
        "admin",
        "notifications",
        userId,
        "templates",
        "list",
        filters.q ?? "",
        filters.eventType,
        filters.channel,
        filters.language ?? "",
        filters.status,
        filters.branchId ?? "",
        filters.sort,
        filters.direction,
        filters.page,
      ] as const,
    notificationTemplateDetail: (userId: string, reference: string) =>
      ["admin", "notifications", userId, "templates", "detail", reference] as const,
    notificationLogList: (
      userId: string,
      filters: {
        q?: string;
        eventType: string;
        channel: string;
        status: string;
        templateReference?: string;
        branchId?: string;
        from?: string;
        to?: string;
        sort: string;
        direction: string;
        page: number;
      },
    ) =>
      [
        "admin",
        "notifications",
        userId,
        "logs",
        "list",
        filters.q ?? "",
        filters.eventType,
        filters.channel,
        filters.status,
        filters.templateReference ?? "",
        filters.branchId ?? "",
        filters.from ?? "",
        filters.to ?? "",
        filters.sort,
        filters.direction,
        filters.page,
      ] as const,
    notificationLogDetail: (userId: string, reference: string) =>
      ["admin", "notifications", userId, "logs", "detail", reference] as const,
    reportMeta: (userId: string) => ["admin", "reports", userId, "meta"] as const,
    report: (
      userId: string,
      filters: {
        report: string;
        preset: string;
        from?: string;
        to?: string;
        comparison: string;
        compareFrom?: string;
        compareTo?: string;
        branchId?: string;
        serviceId?: string;
        staffId?: string;
        resourceId?: string;
        resourceType?: string;
        appointmentStatus?: string;
        paymentStatus?: string;
      },
    ) =>
      [
        "admin",
        "reports",
        userId,
        filters.report,
        filters.preset,
        filters.from ?? "",
        filters.to ?? "",
        filters.comparison,
        filters.compareFrom ?? "",
        filters.compareTo ?? "",
        filters.branchId ?? "",
        filters.serviceId ?? "",
        filters.staffId ?? "",
        filters.resourceId ?? "",
        filters.resourceType ?? "",
        filters.appointmentStatus ?? "",
        filters.paymentStatus ?? "",
      ] as const,
    reportExport: (userId: string, jobId: string) =>
      ["admin", "reports", userId, "export", jobId] as const,
    userList: (
      userId: string,
      filters: {
        q?: string;
        roleReference?: string;
        status: string;
        invitationStatus: string;
        linkedStaff: string;
        branchId?: string;
        lastLoginFrom?: string;
        lastLoginTo?: string;
        sort: string;
        direction: string;
        page: number;
      },
    ) =>
      [
        "admin",
        "users",
        userId,
        "list",
        filters.q ?? "",
        filters.roleReference ?? "",
        filters.status,
        filters.invitationStatus,
        filters.linkedStaff,
        filters.branchId ?? "",
        filters.lastLoginFrom ?? "",
        filters.lastLoginTo ?? "",
        filters.sort,
        filters.direction,
        filters.page,
      ] as const,
    userDetail: (userId: string, reference: string) =>
      ["admin", "users", userId, "detail", reference] as const,
    roleList: (
      userId: string,
      filters: {
        q?: string;
        system: string;
        sort: string;
        direction: string;
        page: number;
      },
    ) =>
      [
        "admin",
        "roles",
        userId,
        "list",
        filters.q ?? "",
        filters.system,
        filters.sort,
        filters.direction,
        filters.page,
      ] as const,
    roleDetail: (userId: string, reference: string) =>
      ["admin", "roles", userId, "detail", reference] as const,
    permissionCatalog: (userId: string) =>
      ["admin", "permissions", userId, "catalog"] as const,
    settingsSection: (userId: string, section: string) =>
      ["admin", "settings", userId, section] as const,
    activityLogList: (
      userId: string,
      filters: {
        q?: string;
        actorReference?: string;
        action: string;
        entityType: string;
        result: string;
        branchId?: string;
        from?: string;
        to?: string;
        sort: string;
        direction: string;
        page: number;
      },
    ) =>
      [
        "admin",
        "activity-logs",
        userId,
        "list",
        filters.q ?? "",
        filters.actorReference ?? "",
        filters.action,
        filters.entityType,
        filters.result,
        filters.branchId ?? "",
        filters.from ?? "",
        filters.to ?? "",
        filters.sort,
        filters.direction,
        filters.page,
      ] as const,
    activityLogDetail: (userId: string, reference: string) =>
      ["admin", "activity-logs", userId, "detail", reference] as const,
    activityLogExport: (userId: string, jobId: string) =>
      ["admin", "activity-logs", userId, "export", jobId] as const,
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
