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
    appointmentPayment: (appointmentId: string) =>
      `/appointments/${appointmentId}/payment`,
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
    manualBooking: "/admin/bookings/new",
    appointments: "/admin/appointments",
    appointmentDetail: (appointmentId: string) => `/admin/appointments/${appointmentId}`,
    appointmentCancel: (appointmentId: string) => `/admin/appointments/${appointmentId}/cancel`,
    appointmentReschedule: (appointmentId: string) =>
      `/admin/appointments/${appointmentId}/reschedule`,
    calendar: "/admin/calendar",
    customers: "/admin/customers",
    customerNew: "/admin/customers/new",
    customerDetail: (customerReference: string) => `/admin/customers/${customerReference}`,
    customerEdit: (customerReference: string) => `/admin/customers/${customerReference}/edit`,
    services: "/admin/services",
    serviceNew: "/admin/services/new",
    serviceDetail: (serviceReference: string) =>
      `/admin/services/${serviceReference}`,
    serviceEdit: (serviceReference: string) =>
      `/admin/services/${serviceReference}/edit`,
    serviceResources: (serviceReference: string) =>
      `/admin/services/${serviceReference}/resources`,
    staff: "/admin/staff",
    staffNew: "/admin/staff/new",
    staffDetail: (staffReference: string) => `/admin/staff/${staffReference}`,
    staffEdit: (staffReference: string) => `/admin/staff/${staffReference}/edit`,
    staffCalendar: (staffReference: string) => `/admin/staff/${staffReference}/calendar`,
    staffPerformance: (staffReference: string) =>
      `/admin/staff/${staffReference}/performance`,
    resources: "/admin/resources",
    resourceNew: "/admin/resources/new",
    resourceDetail: (resourceReference: string) =>
      `/admin/resources/${resourceReference}`,
    resourceEdit: (resourceReference: string) =>
      `/admin/resources/${resourceReference}/edit`,
    resourceCalendar: (resourceReference: string) =>
      `/admin/resources/${resourceReference}/calendar`,
    branches: "/admin/branches",
    branchNew: "/admin/branches/new",
    branchDetail: (branchReference: string) => `/admin/branches/${branchReference}`,
    branchEdit: (branchReference: string) => `/admin/branches/${branchReference}/edit`,
    branchCalendar: (branchReference: string) => `/admin/branches/${branchReference}/calendar`,
    branchSchedule: (branchReference: string) => `/admin/branches/${branchReference}/schedule`,
    schedules: "/admin/schedules",
    scheduleBusiness: "/admin/schedules/business",
    scheduleBranch: (branchReference: string) =>
      `/admin/schedules/branches/${branchReference}`,
    scheduleStaff: (staffReference: string) => `/admin/schedules/staff/${staffReference}`,
    scheduleResource: (resourceReference: string) =>
      `/admin/schedules/resources/${resourceReference}`,
    scheduleHolidays: "/admin/schedules/holidays",
    payments: "/admin/payments",
    paymentDetail: (paymentReference: string) => `/admin/payments/${paymentReference}`,
    coupons: "/admin/coupons",
    couponNew: "/admin/coupons/new",
    couponDetail: (couponReference: string) => `/admin/coupons/${couponReference}`,
    couponEdit: (couponReference: string) => `/admin/coupons/${couponReference}/edit`,
    waitingList: "/admin/waiting-list",
    waitingListNew: "/admin/waiting-list/new",
    waitingListDetail: (entryReference: string) => `/admin/waiting-list/${entryReference}`,
    waitingListOffer: (entryReference: string) => `/admin/waiting-list/${entryReference}/offer`,
    notifications: "/admin/notifications",
    notificationTemplates: "/admin/notifications/templates",
    notificationTemplateDetail: (templateReference: string) =>
      `/admin/notifications/templates/${templateReference}`,
    notificationLogs: "/admin/notifications/logs",
    notificationLogDetail: (logReference: string) => `/admin/notifications/logs/${logReference}`,
    reports: "/admin/reports",
    users: "/admin/users",
    userNew: "/admin/users/new",
    userDetail: (userReference: string) => `/admin/users/${userReference}`,
    userEdit: (userReference: string) => `/admin/users/${userReference}/edit`,
    roles: "/admin/roles",
    roleNew: "/admin/roles/new",
    roleDetail: (roleReference: string) => `/admin/roles/${roleReference}`,
    roleEdit: (roleReference: string) => `/admin/roles/${roleReference}/edit`,
    settings: "/admin/settings",
    settingsGeneral: "/admin/settings/general",
    settingsLocalization: "/admin/settings/localization",
    settingsBooking: "/admin/settings/booking",
    settingsPayments: "/admin/settings/payments",
    settingsNotifications: "/admin/settings/notifications",
    activityLogs: "/admin/activity-logs",
    activityLogDetail: (logReference: string) => `/admin/activity-logs/${logReference}`,
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
