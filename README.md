# Appointment System Frontend

Frontend application for a dedicated online appointment booking system. This
repository contains frontend code only. Backend changes belong in
`appointment-system-backend`.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript (strict)
- TanStack Query
- Semantic CSS design tokens

## Start locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000.

## Quality commands

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## Phase notes

- Public, authentication, customer, and admin route groups are in place.
- Customer URLs are cookie-gated in `src/proxy.ts` toward `/login`. Admin URLs
  go to `/admin/login`. `/admin/login` itself is not treated as a protected
  admin route.
- Session restoration calls `GET {NEXT_PUBLIC_API_BASE_URL}/auth/session`.
- Auth UI lives in Phase 3 and follows `BACKEND_DEPENDENCIES.md`.
- The public homepage is Phase 4 and reads `/public/business`, `/public/services`,
  and optional public providers/branches.
- The customer dashboard is Phase 5 at `/dashboard` and reads
  `GET /customer/dashboard`. Missing Backend fields are documented in
  `BACKEND_DEPENDENCIES.md`.
- Public services catalog and detail are Phase 6 at `/services` and
  `/services/[id]`, reading `GET /public/services` and
  `GET /public/services/{id}`.
- Public Provider presentation and selection are Phase 7. The reusable
  `ProviderSelector` is used by the Booking Wizard; homepage and service
  detail only present public Providers.
- The Booking Wizard is Phase 8 at `/booking`. Steps are composed dynamically.
- Availability Calendar and Slot selection are Phase 9. Dates and slots come
  only from `/public/booking/availability/dates` and `/slots`. The UI does not
  generate slots or show internal resources.
- Booking Summary and Quote review are Phase 10. Pricing, deposit, discount,
  and payment mode come only from `POST /public/booking/quote`. Confirmation
  uses `POST /customer/bookings` with an `Idempotency-Key`. The frontend does
  not calculate totals or open a payment gateway.
- Booking Confirmation is Phase 11 at `/booking/confirmation/[reference]`. The
  page GETs `GET /customer/bookings/{reference}` and does not resubmit the
  booking. Draft restoration is blocked after a completed booking.
- Slot Hold and countdown are Phase 12 at `/booking/hold/[reference]`. A Hold is
  created only for online payment via `POST /customer/bookings/holds`. The
  countdown uses `expiresAt` and `serverNow`; it is not a local timer.
- Customer Payment is Phase 13 at `/booking/payment` and `/booking/payment/result`.
  Methods and amounts come from Quote. Coupon codes go to Quote for a new
  Backend Quote. Payment Intent uses `POST /customer/payments/sessions`. Success
  requires Backend verify; Gateway query `status` is not trusted.
- Customer appointments are Phase 14 at `/appointments`. Tabs are
  `?category=upcoming|past|cancelled`. The list is `GET /customer/appointments`.
  Reschedule stays hidden until Phase 17. Repeat Booking opens the wizard with
  service/provider/branch only.
- Customer appointment detail is Phase 15 at `/appointments/[reference]`. Detail
  is `GET /customer/appointments/{reference}` with optional timeline sub-read.
  Snapshots, payment, policies, and action eligibility come from Backend only.
- Customer appointment cancellation is Phase 16 at
  `/appointments/[reference]/cancel`. Preview, policy, refund, and reason codes
  come from Backend only. Cancellation is not optimistic; refund amounts are
  never calculated in the frontend.
- Customer appointment reschedule is Phase 17 at
  `/appointments/[reference]/reschedule`. Eligibility, availability, policy, and
  financial adjustments come from Backend only. The current appointment is kept
  until confirmed success.
- Customer profile and account settings are Phase 18 at `/profile`,
  `/profile/edit`, `/profile/security`, and `/profile/notifications`. Profile,
  verification, and notification preferences come from Backend only. Avatar
  upload and account deactivation are omitted until Backend contracts exist.
- Customer payment history is Phase 19 at `/payments` and
  `/payments/[paymentReference]`. List, filters, pagination, refund display, and
  receipt access come from Backend only. The frontend does not calculate totals,
  outstanding balances, or refund amounts.
- Customer notifications are Phase 20 at `/notifications` (header bell + list +
  optional detail). Unread counts, read state, and deep links come from Backend
  only. Waiting-list deep links resolve to `/waiting-list/*`. Review deep links
  resolve to `/appointments/{ref}/review`. Real-time push is not implemented.
- Customer waiting list is Phase 21 at `/waiting-list`, `/waiting-list/join`,
  `/waiting-list/[entryReference]`, and `/waiting-list/offers/[offerReference]`.
  Join eligibility, offers, and accept/reject outcomes come from Backend only.
  Joining never creates a confirmed appointment on the client.
- Customer appointment reviews are Phase 22 at
  `/appointments/[appointmentReference]/review`. Eligibility, rating scale,
  comment rules, and moderation state come from Backend only. Capability
  `reviews` gates visibility. Edit/delete are omitted until Backend supports them.
- Admin application shell is Phase 23 under `/admin/*`. Shared layout includes
  sidebar/drawer, header, breadcrumb, user menu, and notification shell.
  Navigation is permission- and capability-filtered. Manual Booking and
  Schedules are omitted until those routes exist.
- Admin operational dashboard is Phase 24 at `/admin`. Metrics, alerts, and
  recent appointments come from `GET /admin/dashboard` only. Quick Add stays
  hidden until Phase 26 manual booking route exists.
- Admin appointment management is Phase 25 at `/admin/appointments` with detail,
  cancellation, internal note, and status actions driven by Backend
  `allowedActions`. Admin reschedule UI stays gated until its API exists.
- Admin manual booking is Phase 26 at `/admin/bookings/new`. Customer search,
  create, availability, allocation, quote, and confirm use admin booking APIs.
- Admin operational calendar is Phase 27 at `/admin/calendar`. Visible-range
  events (appointments, blocked time, time off), Day/Week/Month, and grouping
  come from `GET /admin/calendar`. Drag & Drop is not enabled.
- Admin resource management is Phase 28 at `/admin/resources` (list, create,
  edit, detail, calendar redirect). Unified Resource model covers rooms,
  devices, and other operational resources; Staff administration stays Phase 29.
  Resource Calendar reuses Phase 27 with a preselected resource filter.
- Admin staff management is Phase 29 at `/admin/staff` (list, create, edit,
  detail, calendar redirect, optional performance). Staff, Bookable Provider,
  Admin User, and Resource references stay distinct. Customer-visible and
  bookable flags are independent.
- Admin service resource mapping is Phase 30 at
  `/admin/services/[serviceReference]/resources`. Defines per-service resource
  requirements (any-of-type vs specific); allocation and slots remain backend-driven.
- Admin service management is Phase 31 at `/admin/services` (list, create, edit,
  detail, customer preview). Resource requirements reuse Phase 30 editor in the
  edit form and dedicated resources sub-route.
- Admin schedule management is Phase 32 at `/admin/schedules` (shared editor for
  business, branch, staff, and resource working hours, breaks, holidays, time off,
  and blocks). Effective schedule and impact preview remain backend-driven.
- Admin reports are Phase 39 at `/admin/reports`. Metrics, comparisons, peak times,
  and exports come from Backend report endpoints only — never client-side aggregation.
- Admin users/roles are Phase 40 at `/admin/users` and `/admin/roles`. Permission
  Matrix uses Backend catalog only; Admin User, Staff, and Customer stay distinct.
- Admin business settings are Phase 41 at `/admin/settings` (general, localization,
  booking, payments, notifications). High-impact currency/timezone and booking
  changes use Backend impact preview; no client FX or scheduling math.
- Admin activity logs are Phase 42 at `/admin/activity-logs`. Immutable Backend
  audit records only — no client-fabricated events or editable log entities.
- Phase 43 responsive audit remediates public, auth, customer, and admin layouts
  against canonical breakpoints (480 / 768 / 1024 / 1280). Customer/public are
  mobile-first; admin is desktop-first with drawer navigation below 1024px.
  Sticky CTAs use safe-area insets; admin tables dual-layout at `64rem`.
- Phase 44 global UX states standardize loading/empty/no-results/error/permission/
  feature-disabled/backend-dependency/conflict/session-expired across routes.
  Session expiry clears sensitive caches once; toasts soft-dedupe; destructive
  confirms focus Cancel first. Shared components live in `src/components/feedback/`.
- Design System catalog (development only): http://localhost:3000/dev/design-system

## Repository boundary

Do not add marketplace, tenant, subscription, provider onboarding, or
cross-business search concepts. This UI serves one business.
