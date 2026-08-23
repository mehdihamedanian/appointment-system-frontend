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
- Design System catalog (development only): http://localhost:3000/dev/design-system

## Repository boundary

Do not add marketplace, tenant, subscription, provider onboarding, or
cross-business search concepts. This UI serves one business.
