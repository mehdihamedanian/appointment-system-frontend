export const routes = {
  public: {
    home: "/",
    services: "/services",
    serviceDetail: (serviceId: string) => `/services/${serviceId}`,
  },
  auth: {
    login: "/login",
    register: "/register",
    verifyOtp: "/verify-otp",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
    sessionExpired: "/session-expired",
    adminLogin: "/admin/login",
  },
  customer: {
    dashboard: "/dashboard",
    booking: "/booking",
    bookingConfirmation: (reference: string) => `/booking/confirmation/${reference}`,
    bookingHold: (holdReference: string) => `/booking/hold/${holdReference}`,
    bookingPayment: "/booking/payment",
    bookingPaymentResult: "/booking/payment/result",
    appointments: "/appointments",
    appointmentDetail: (appointmentId: string) =>
      `/appointments/${appointmentId}`,
    appointmentCancel: (appointmentId: string) =>
      `/appointments/${appointmentId}/cancel`,
    appointmentReschedule: (appointmentId: string) =>
      `/appointments/${appointmentId}/reschedule`,
    appointmentReview: (appointmentId: string) =>
      `/appointments/${appointmentId}/review`,
    payments: "/payments",
    paymentDetail: (paymentReference: string) => `/payments/${paymentReference}`,
    notifications: "/notifications",
    notificationDetail: (notificationId: string) => `/notifications/${notificationId}`,
    waitingList: "/waiting-list",
    waitingListJoin: "/waiting-list/join",
    waitingListEntry: (entryReference: string) => `/waiting-list/${entryReference}`,
    waitingListOffer: (offerReference: string) => `/waiting-list/offers/${offerReference}`,
    profile: "/profile",
    profileEdit: "/profile/edit",
    profileSecurity: "/profile/security",
    profileNotifications: "/profile/notifications",
  },
  admin: {
    home: "/admin",
    appointments: "/admin/appointments",
    calendar: "/admin/calendar",
    customers: "/admin/customers",
    services: "/admin/services",
    staff: "/admin/staff",
    resources: "/admin/resources",
    branches: "/admin/branches",
    payments: "/admin/payments",
    waitingList: "/admin/waiting-list",
    notifications: "/admin/notifications",
    reports: "/admin/reports",
    users: "/admin/users",
    roles: "/admin/roles",
    settings: "/admin/settings",
    activityLogs: "/admin/activity-logs",
  },
} as const;

export const AUTH_PATHS = [
  routes.auth.login,
  routes.auth.register,
  routes.auth.verifyOtp,
  routes.auth.forgotPassword,
  routes.auth.resetPassword,
  routes.auth.sessionExpired,
  routes.auth.adminLogin,
] as const;

export const CUSTOMER_PATH_PREFIXES = [
  routes.customer.dashboard,
  routes.customer.booking,
  routes.customer.appointments,
  routes.customer.payments,
  routes.customer.notifications,
  routes.customer.waitingList,
  routes.customer.profile,
] as const;

export const ADMIN_PATH_PREFIX = "/admin";

export const DEFAULT_AUTHENTICATED_PATH = routes.customer.dashboard;
export const LOGIN_PATH = routes.auth.login;
export const ADMIN_LOGIN_PATH = routes.auth.adminLogin;
export const SESSION_EXPIRED_PATH = routes.auth.sessionExpired;
