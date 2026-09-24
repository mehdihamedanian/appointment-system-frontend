# Backend Dependency / API Contract

This frontend is a dedicated booking UI for a **single business**. It does not
implement authentication, authorization, or persistence. The items below are
required from `appointment-system-backend`. The live Backend currently exposes
health only; the frontend Auth UI is built against this contract and adapters.

## Public configuration

| Name | Where used | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | API client | Public base URL including `/api/v1` if that is the prefix |
| `SESSION_COOKIE_NAME` | `src/proxy.ts` | Name of the HttpOnly session cookie. Default: `session` |

No secrets belong in the frontend environment.

## Session

Preferred model: **HttpOnly, Secure, SameSite cookie** issued by the Backend.
The frontend never stores access tokens, refresh tokens, OTPs, or passwords in
`localStorage` or `sessionStorage`. OTP codes are kept only in component state.
Reset tokens are read from the URL once or held in memory; they are not logged.

Expected session endpoint:

- `GET {API}/auth/session`
- Cookie credentials included (`credentials: "include"`)
- Server components forward the incoming `Cookie` header

Suggested authenticated payload (adapter also accepts `data.user` / `session.user`):

```json
{
  "user": {
    "id": "stable-id",
    "displayName": "optional",
    "email": "optional",
    "phone": "optional",
    "jobTitle": "optional public role/job label",
    "permissionCodes": ["opaque.code.from.backend"],
    "adminPanelAccess": "granted"
  }
}
```

`adminPanelAccess` must be one of `granted`, `denied`, or omitted (`unknown`).
Do not send invented role names; permission codes stay opaque until this
contract is finalized. Optional `jobTitle` / `title` / `roleLabel` may appear in
the admin user menu; the frontend never invents it.

Unauthenticated response: `401`.
Expired session: `401` with a code containing `EXPIRED` or `SESSION`.

## Customer authentication methods

The UI supports **phone + password** and **phone + OTP** for customers. Email
login is not shown. Staff, provider, doctor, administrator, business, and tenant
self-registration are not offered.

Iranian mobile format sent by the frontend: `09XXXXXXXXX` (Latin digits).

### Login

- `POST {API}/auth/login`
- Body: `{ "phone": "09XXXXXXXXX", "password": "..." }`
- Success: session cookie + optional user payload (same shape as session)
- Invalid credentials: `401` without revealing whether the phone exists
- Inactive/blocked: code containing `BLOCK`, `INACTIVE`, `DISABLED`, or `SUSPEND`
- Rate limit: `429`

### Registration (customers only)

- `POST {API}/auth/register`
- Body: `{ "firstName", "lastName", "phone", "password", "consent": true }`
- Success may return a session user, an OTP challenge, or `204`
- If neither user nor `challengeId` is returned, the UI requests an OTP next
- `409` is mapped to a generic existing-account message (no enumeration)

### OTP

- `POST {API}/auth/otp/request` body: `{ "phone", "purpose": "login" | "register" | "reset_password" }`
- `POST {API}/auth/otp/verify` body: `{ "challengeId", "code" }`
- `POST {API}/auth/otp/resend` body: `{ "challengeId" }`

Required challenge fields (adapter also reads snake_case):

```json
{
  "challengeId": "opaque-id",
  "maskedDestination": "0912***21",
  "expiresAt": "2026-08-21T12:00:00.000Z",
  "resendAvailableAt": "2026-08-21T11:59:00.000Z"
}
```

If `expiresAt` / `resendAvailableAt` are omitted, the UI currently falls back to
120s / 60s. **The Backend should return authoritative timestamps** so countdown
and resend stay correct after tab backgrounding.

OTP error codes mapped by the UI:

- `OTP_INVALID` / `CODE_INVALID`
- `OTP_EXPIRED` / `CODE_EXPIRED`
- challenge expired (`CHALLENGE` + `EXPIRED`)
- too many attempts (`ATTEMPT`)
- `429` rate limit

Verify for `reset_password` should return `{ "resetToken": "..." }` or `{ "token": "..." }`.
The frontend does not assume other sessions are invalidated after reset.

### Password recovery

- `POST {API}/auth/password/forgot` body: `{ "phone" }`
- Always treated as success for `2xx` and most `4xx` (privacy-safe copy)
- Network (`0`) and `429` are shown as failures
- Optional challenge in the response continues the OTP reset flow
- `POST {API}/auth/password/reset` body: `{ "token", "password" }`
- `POST {API}/auth/password/change` body: `{ "currentPassword", "newPassword" }` (Profile phase)

### Admin login

- `POST {API}/auth/admin/login` body: `{ "phone", "password" }`
- No admin registration
- Success must set the session cookie and user with `adminPanelAccess: "granted"`
  (or omit it as `unknown`)
- Ordinary customers (`adminPanelAccess: "denied"`) are not sent to `/admin`
- `403` / permission codes: insufficient access

### Logout

- `POST {API}/auth/logout`
- Must clear the session cookie
- The frontend always clears React Query cache locally, even if logout fails

### Refresh

- `POST {API}/auth/refresh` or cookie rotation on the session endpoint
- Not called by Phase 3 UI yet; needed if access cookies are short-lived

## Standard error response

The client does not require an exact schema. It reads, when present:

- `message`, `detail`, `title`
- `code`, `errorCode`
- `fieldErrors` / `errors` / `violations`
- `requestId` / `correlationId`
- `X-Request-Id` or `X-Correlation-Id` headers

Normalized frontend error:

```ts
type AppApiError = {
  status: number;
  code?: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
};
```

Status handling already includes `401`, `403`, `404`, `409`, `422`, `429`, and
`5xx`. Raw Backend messages, stack traces, and internal codes are not shown in
Auth forms.

## Capabilities of this one business

Optional modules are not tenants. A later endpoint should describe this
business only:

- `multipleBranches`
- `selectableProviders`
- `onlinePayments`
- `waitingList`
- `reviews`

Until that endpoint exists, all values stay `unknown` and navigation remains
visible.

## Public business homepage

The dedicated public page at `/` reads this one business only. There is no
marketplace, directory, or tenant switcher.

Expected endpoints (adapters also accept nested `data` / `items` / snake_case):

- `GET {API}/public/business`
- `GET {API}/public/services`
- `GET {API}/public/providers` (only requested when provider presentation is enabled)
- `GET {API}/public/branches` (only requested when multiple branches are enabled)

Suggested business payload:

```json
{
  "name": "نام مجموعه",
  "tagline": "optional",
  "shortDescription": "optional",
  "about": "optional",
  "fieldOfActivity": "optional",
  "visitInfo": "optional",
  "logoUrl": "https://...",
  "heroImageUrl": "https://...",
  "phone": "021...",
  "email": "optional",
  "address": "optional",
  "directionsUrl": "optional",
  "timezone": "Asia/Tehran",
  "currency": "IRR",
  "bookingEnabled": true,
  "selectableProviders": false,
  "multipleBranches": false,
  "workingHours": [{ "day": "saturday", "start": "09:00", "end": "17:00" }],
  "socialLinks": [{ "label": "اینستاگرام", "href": "https://..." }]
}
```

Services must be public and active. Include duration and a **preformatted**
price label when they should be shown. The frontend does not calculate prices
or invent availability.

Providers must already be filtered for public presentation. The UI additionally
hides internal kinds such as room, device, bed, chair, desk, and equipment.

`timezone` is required for a reliable “open now” message. Without it, the UI
shows weekly hours only and does not claim real-time open/closed status.

`NEXT_PUBLIC_SITE_URL` is used for canonical/Open Graph URLs. Leave it empty in
development; do not hardcode a production domain in the app.

The `/booking` route remains customer-protected from Phase 1. Homepage CTAs
pass only safe `service` / `provider` / `branch` query ids as UI preselection.

## Public services catalog

Customers browse only this business’s public services at `/services` and
`/services/{id-or-slug}`. Internal resources stay hidden.

Expected endpoints:

- `GET {API}/public/services` — full public active catalog (same resource as the
  homepage featured list). Preserve sort order. Do **not** include inactive or
  archived services in this list.
- `GET {API}/public/services/{idOrSlug}` — public detail for one service
- `GET {API}/public/services/{id}/providers` — optional related public providers
- `GET {API}/public/services/{id}/branches` — optional branches that offer the service

Optional query on the catalog: `q`, `category`. Honor these when the catalog is
**paginated** (`page` / `pageSize` / `hasMore`). If the catalog is the full
unpaged list, the frontend filters locally and will not send a misleading
client-only search over a page.

Suggested service item:

```json
{
  "id": "svc_1",
  "slug": "optional-safe-slug",
  "name": "ویزیت",
  "shortDescription": "optional plain text",
  "description": "optional plain text",
  "preparation": "optional",
  "visitInfo": "optional",
  "policy": "optional",
  "imageUrl": "https://...",
  "durationMinutes": 30,
  "priceLabel": "۲۵۰٬۰۰۰ ریال",
  "priceType": "fixed",
  "currency": "IRR",
  "depositLabel": "optional",
  "depositType": "none",
  "bookingEnabled": true,
  "category": { "id": "cat_a", "name": "عمومی" }
}
```

Price: send a **preformatted** `priceLabel` whenever possible. Supported
`priceType` values: `fixed`, `starting_from`, `free`, `contact`, `hidden`.
The UI does not calculate discounts or a final booking amount. Integer
`price` values may be formatted with the business currency; fractional
amounts are ignored.

Deposit: send `depositLabel` or integer `depositAmount` / `depositPercent`.
Do not expect the frontend to compute percent-of-price. Types: `none`,
`fixed`, `percentage`, `full`, `pay_at_location`.

`temporarilyUnavailable: true` (or `status: "unavailable"`) keeps the service
visible on detail without an active booking CTA. List endpoints should omit
inactive/archived rows.

Related providers must already be public and active. Nested `providers` /
`branches` on the detail payload are preferred; dedicated endpoints are used
only when those keys are absent. `404` on those optional endpoints is treated
as empty, not as a missing service.

`/booking?service={id}` is **initial intent only**. The Booking Wizard must
re-fetch `GET /public/services/{id}` (see `revalidateBookableService`) and
must not trust price, duration or availability from the URL.

## Public provider selection

Customers may choose a public human Provider / Specialist for a booking. The
UI must never expose internal operational resources (room, device, chair,
desk, bed, equipment) or private staff fields.

Expected endpoints:

- `GET {API}/public/providers` — homepage presentation only, already public
  and active. Do not include internal resources.
- `GET {API}/public/services/{serviceId}/providers?branchId=` — eligible
  Providers for the current booking context

The eligibility endpoint is **not** a staff directory. Return only public,
active, human Providers that can perform the selected service at the optional
branch. Preserve Backend sort order. Omit inactive, private, and internal
resources; the frontend filter is not a security boundary.

Do **not** expect the frontend to infer the selection step from the number of
Providers. Send an explicit mode:

```json
{
  "selectionMode": "optional",
  "anyAvailableAllowed": true,
  "assignmentLabel": "تخصیص توسط مجموعه",
  "providers": [
    {
      "id": "p1",
      "name": "سارا محمدی",
      "publicTitle": "کارشناس",
      "specialty": "optional",
      "shortBio": "optional public bio",
      "imageUrl": "https://...",
      "relatedServiceNames": ["رنگ مو"],
      "branchNames": ["شعبه مرکزی"],
      "availabilitySummary": "optional public sentence only"
    }
  ]
}
```

`selectionMode` values:

- `not_applicable` — no Provider step; do not send a customer-facing list
- `automatic` — system assignment; optional `assignmentLabel` (default:
  «تخصیص توسط مجموعه»)
- `optional` — customer may pick one Provider or explicit «فرقی ندارد»
- `required` — exactly one eligible public Provider must be selected

`anyAvailableAllowed` is honored for `required` only when `true`. `optional`
always includes «فرقی ندارد». That option is **not** a Provider id, `0`,
empty string, or a frontend-random assignment; the Backend still chooses the
first eligible available Provider.

If `selectionMode` is omitted, the frontend treats the payload as presentation
data and does **not** open a selection step.

Never include phone, email, internal notes, working schedule, leave,
utilization, revenue, allocation, capacity, or room/device assignment.

Do not send slot-level availability, “available today”, or internal calendars
on this endpoint. Date and slot availability belong to a later booking phase.
When the selected service or branch changes, the frontend refetches this
resource and drops incompatible Provider preferences.

The Booking Wizard is implemented at `/booking` (customer session required).
`ProviderSelector` is used for the Provider step. Date, slot and quote calls
are integration boundaries until those APIs exist.

## Booking wizard

`/booking` is customer-protected. Query `service`, `branch`, and `provider`
are **intent only** and are revalidated. The frontend does not calculate
availability, prices, discounts, or resource allocation.

Expected endpoints:

- `GET {API}/public/booking/availability/dates?serviceId=&branchId=&providerId=&preference=&month=YYYY-MM`
- `GET {API}/public/booking/availability/slots?serviceId=&branchId=&providerId=&preference=&date=YYYY-MM-DD`
- `POST {API}/public/booking/quote`
- `POST {API}/customer/bookings/preview`
- `POST {API}/customer/bookings`

`404` on these endpoints is treated as “not yet available”. The UI will **not**
invent bookable days or slots from working hours, and it does not fetch a
whole month of slots in the browser.

Date requests are month-scoped. Slot requests run only after a valid date is
selected. Query keys include service, branch, provider preference, and
month/date so a late Provider A response cannot replace Provider B.

Suggested dates payload:

```json
{
  "timezone": "Asia/Tehran",
  "month": "2026-08",
  "minDate": "2026-08-22",
  "maxDate": "2026-11-22",
  "serverNow": "2026-08-21T21:00:00Z",
  "days": [
    { "date": "2026-08-22", "status": "available" },
    { "date": "2026-08-23", "status": "closed" },
    { "date": "2026-08-24", "status": "no_capacity" }
  ]
}
```

`status` may be `available`, `closed`, `no_capacity` / `full`, or omitted.
A plain `dates: ["2026-08-22"]` list is also accepted; days not listed are
shown as generic unavailable. If closed vs full is not distinguished, the UI
does not invent that distinction.

`timezone` and `serverNow` are required for a reliable “today” and past-day
lock. Without them the UI falls back to the business timezone from
`GET /public/business`, then to the device clock. Branch-specific timezone is
not currently on the public branch payload.

Suggested slots payload (ids are opaque tokens in `[A-Za-z0-9_-]{1,80}`;
labels are display-only):

```json
{
  "timezone": "Asia/Tehran",
  "slots": [
    {
      "id": "slot_1",
      "startsAt": "2026-08-22T09:00:00+03:30",
      "endsAt": "2026-08-22T09:30:00+03:30",
      "label": "09:00",
      "status": "available"
    }
  ]
}
```

`startsAt` should be an ISO timestamp in the business timezone. The frontend
does not combine `date` + `"10:30"` into an authoritative timestamp. `status`
may be `available`, `unavailable`, or `held`. Preserve backend order.
Do not include rooms, devices, chairs, desks, beds, equipment, or allocation
ids.

`409` / `SLOT_TAKEN` clears the selected slot, keeps service/branch/provider/date,
refetches the current day’s slots, and returns the customer to Time with
«این زمان دیگر در دسترس نیست.» A replacement slot is never auto-selected.
`handleSlotTaken` in `src/lib/availability/slot-taken.ts` is the reusable
handler for later Hold/booking revalidation.

Waiting List is available only when Backend sets `waitingListJoinAllowed` /
`canJoinWaitingList` on the slots payload (and the `waitingList` capability is
not disabled). Empty availability alone never enables the join CTA.

See **Customer waiting list (Phase 21)** for the full contract.

Suggested quote / preview payload:

```json
{
  "id": "quote_1",
  "expiresAt": "2026-08-22T10:00:00Z",
  "serverNow": "2026-08-22T09:50:00Z",
  "timezone": "Asia/Tehran",
  "durationMinutes": 30,
  "paymentMode": "deposit",
  "changed": false,
  "policyChanged": false,
  "service": { "name": "ویزیت", "durationMinutes": 30, "shortDescription": "optional" },
  "provider": { "mode": "specific", "name": "public name", "title": "optional" },
  "branch": { "name": "شعبه مرکزی", "address": "optional" },
  "slot": {
    "id": "slot_1",
    "startsAt": "2026-08-22T09:00:00+03:30",
    "endsAt": "2026-08-22T09:30:00+03:30",
    "label": "09:00"
  },
  "pricing": {
    "currency": "IRR",
    "baseAmount": { "label": "۳۰۰٬۰۰۰ تومان" },
    "fees": [{ "id": "fee_1", "label": "هزینه خدمات", "amountLabel": "۱۰٬۰۰۰ تومان", "kind": "fee" }],
    "discountAmount": { "label": "۵۰٬۰۰۰ تومان" },
    "taxAmount": { "label": "optional" },
    "totalAmount": { "label": "۲۶۰٬۰۰۰ تومان" },
    "payableNow": { "label": "۱۰۰٬۰۰۰ تومان" },
    "payableAtLocation": { "label": "۱۶۰٬۰۰۰ تومان" }
  },
  "cancellationPolicy": {
    "summary": "کوتاه",
    "fullText": "متن کامل",
    "rescheduleSummary": "optional",
    "refundability": "optional",
    "consentRequired": true,
    "consentLabel": "قوانین را می‌پذیرم"
  }
}
```

Label-only fields (`priceLabel`, `depositLabel`, `finalAmountLabel`, `checkoutPath`)
are still accepted. Prefer preformatted `label` values for money. Integer minor
units are formatted for display only; the UI never sums lines, never applies a
percentage, and never infers `totalAmount` or `payableNow`.

`paymentMode`: `none` | `full` | `deposit` | `pay_at_location`.
`checkoutPath` remains accepted as `confirm` | `pay_full` | `pay_deposit` |
`pay_at_location`. The frontend never chooses the next route from a local
amount. Omit `expiresAt` when Quotes do not expire; the UI will not invent a
timer. Quote expiration is not a Slot Hold timer.

`changed: true` or `409 QUOTE_CHANGED` / `PRICE_CHANGED` stays on Summary with
«مبلغ یا شرایط رزرو به‌روزرسانی شد.» `policyChanged: true` resets consent.

Quote request body (no resource ids, no client amounts):

```json
{
  "serviceId": "svc_1",
  "branchId": "optional",
  "providerPreference": { "type": "specific", "providerId": "p1" },
  "slotId": "slot_1",
  "date": "2026-08-22",
  "additionalData": { "fieldId": "value" },
  "quoteId": "optional"
}
```

Confirm: `POST {API}/customer/bookings` with cookie credentials and header
`Idempotency-Key`. Reuse the same key for a safe retry of the same intent;
a new key is created after a material change (service, branch, provider,
date, slot, quote id, additional answers). Suggested confirm response:

```json
{
  "status": "confirmed",
  "id": "apt_1",
  "reference": "apt_1"
}
```

`status` may be `confirmed` | `payment_required` | `held` | `quote_changed`.
Return a public `id` / `reference` in `[A-Za-z0-9_-]{1,80}`. Do not put payment
tokens in this payload’s URL-facing fields. `404` means the confirm API is not
connected; the UI will not create a booking. Network timeouts after submit are
treated as uncertain: the same idempotency key is retried, a new booking is not
started.

This Backend currently does not document an idempotency contract. The frontend
sends `Idempotency-Key` and depends on the API to treat duplicate keys as the
same intent.

Quote `changed: true` requires explicit review.

## Slot Hold (temporary reservation before online payment)

A Hold is created **only** when online payment is required (`pay_full` /
`pay_deposit`). Pay-at-location and direct confirmation do **not** create a
Hold. The UI does not invent a local timer, extend `expiresAt`, or lock
resources. Countdown starts only after a real Hold payload with `expiresAt`.

Expected endpoints:

- `POST {API}/customer/bookings/holds`
  - Cookie credentials
  - Header `Idempotency-Key` (same key reused for the same quote/slot intent)
  - Body: same public fields as Quote (`serviceId`, optional `branchId`,
    `providerPreference`, `date`, `slotId`, `additionalData`, `quoteId`)
  - Do not accept client amounts, resource ids, or Hold secrets in the body
  - `409` `SLOT_TAKEN` → customer returns to Time
  - `409` `QUOTE_CHANGED` / `PRICE_CHANGED` → customer returns to Summary
  - `404` → Hold API is not connected; the UI will not fake a reservation
- `GET {API}/customer/bookings/holds/{reference}`
  - Cookie credentials
  - Backend must verify ownership
  - `401` session expired
  - `403` / `404` are treated as invalid (not active)

Payment Intent creation moved to Customer Payment (Phase 13). The Hold page
only revalidates an active Hold and navigates to `/booking/payment`.

Suggested Hold payload:

```json
{
  "id": "hold_1",
  "publicReference": "hold_1",
  "status": "active",
  "expiresAt": "2026-08-22T10:05:00.000Z",
  "serverNow": "2026-08-22T10:00:00.000Z",
  "timezone": "Asia/Tehran",
  "slot": { "id": "slot_1", "startsAt": "2026-08-22T09:00:00+03:30" },
  "service": { "name": "ویزیت" },
  "provider": { "name": "optional public name" },
  "branch": { "name": "شعبه مرکزی" },
  "payableNowLabel": "۲۵۰٬۰۰۰ تومان",
  "paymentContextId": "optional-public-id",
  "paymentStatus": "unpaid",
  "bookingReference": "optional-when-consumed"
}
```

`status`: `active` | `expired` | `consumed` | `released` | `invalid`.
`reference` / `id` must be a public non-sequential token in
`[A-Za-z0-9_-]{1,80}` (not a numeric database id).

`serverNow` is required for an authoritative countdown. If it is omitted, the
UI falls back to the existing server-clock offset pattern (elapsed local time
since the payload was received). The frontend never stores remaining seconds as
source of truth.

Omit rooms, devices, chairs, desks, beds, allocations, `clientSecret`,
`holdToken`, `lockId`, and internal resource locks. Do not put Hold or payment
secrets in URLs. The Hold page is `/booking/hold/{publicReference}`.

Hold status and payment status stay separate. `consumed` + `bookingReference`
routes to confirmation GET. `consumed` + pending payment stays on status check.
`expired` + unpaid returns to Time without auto-selecting a slot.

This Backend currently exposes health only; these Hold endpoints are not mounted.
The frontend will not simulate Holds.

## Customer Payment (Phase 13)

The frontend displays Backend-approved methods and amounts, submits coupon codes
for Quote validation, creates a Payment Intent, redirects only to an allowlisted
Gateway URL from the Backend response, and asks the Backend to verify after
return. It does not calculate amounts, collect cards, or treat Gateway query
parameters as proof of payment.

Routes: `/booking/payment` and `/booking/payment/result?ref={publicPaymentReference}`.
`/payments` remains payment history (not checkout).

Expected Quote additions (same `POST {API}/public/booking/quote`):

- Optional body field `couponCode`
- Optional `paymentMethods` / `paymentOptions` array. If omitted, the UI shows
  the single declared `paymentMode` (`full` | `deposit` | `pay_at_location`).
  Do not expect the frontend to infer methods from amounts.
- Optional `coupon: { "code", "status", "message" }` where `status` is
  `applied` | `invalid` | `expired` | `not_applicable` | `limit_reached`

Coupon errors may also be `422` with codes containing `COUPON`, `EXPIRED`,
`LIMIT`, or `NOT_APPLICABLE`. Field errors stay beside the coupon input. A
successful coupon must return a **new Quote**; the UI never computes discount.

Expected payment endpoints:

- `POST {API}/customer/payments/sessions`
  - Cookie credentials
  - Header `Idempotency-Key` (same key while hold + quote + method + coupon are
    unchanged; a new key after a material change)
  - Body: `{ "method": "full" | "deposit" | "pay_at_location", "holdReference",
    "quoteId", "couponCode", "bookingReference" }`
  - Do not accept client amounts
  - `pay_at_location` must not return a Gateway `redirectUrl`
  - `404` → gateway/payment API is not connected; no fake session
  - `409` `SLOT_TAKEN` → Time step
  - `409` `QUOTE_CHANGED` / `PRICE_CHANGED` → re-quote
  - `409` `ALREADY_PAID` / `ALREADY_PROCESSING` → result/status, no second intent
- `POST {API}/customer/payments/{reference}/verify`
  - Cookie credentials, ownership check
  - Body: `{ "paymentReference" }`
  - Backend confirms paid / failed / pending / cancelled / expired
  - Gateway `status=success` query values are ignored by the frontend
  - `404` → frontend falls back to GET status
- `GET {API}/customer/payments/{reference}`
  - Cookie credentials, ownership check
  - Same public result shape as verify
  - Refresh and direct recovery must work

Suggested session / result payload:

```json
{
  "id": "pay_1",
  "publicReference": "pay_1",
  "status": "redirect_required",
  "redirectUrl": "https://gateway.example/session/...",
  "expiresAt": "2026-08-22T10:15:00.000Z",
  "gatewayName": "example-gateway",
  "payableNowLabel": "۲۵۰٬۰۰۰ تومان",
  "bookingReference": "BK22A",
  "transactionReference": "trx_1",
  "paidAt": "2026-08-22T10:06:00.000Z",
  "retryAllowed": false,
  "alreadyPaid": false,
  "alreadyProcessing": false
}
```

`status`: `created` | `redirect_required` | `processing` | `pending` | `paid` |
`deposit_paid` | `failed` | `cancelled` | `expired` | `pay_at_location`.
`reference` / `id` must be a public non-sequential token in
`[A-Za-z0-9_-]{1,80}`.

`redirectUrl` must be an `https` origin listed in
`NEXT_PUBLIC_PAYMENT_GATEWAY_ORIGINS` (comma-separated). If that env is empty,
the UI refuses to redirect. Do not return `clientSecret`, card data, Hold
tokens, or lock ids. Do not put secrets in `redirectUrl` query if they would be
logged; the frontend never logs the full redirect URL.

Gateway return URL should send the customer to
`/booking/payment/result?ref={publicPaymentReference}` only. Extra Gateway
query keys (`status`, `Authority`, tokens) are ignored.

This Backend currently exposes health only; these payment endpoints are not
mounted. The frontend will not simulate Gateway responses or paid amounts.

## Booking confirmation

After a successful confirm, the UI navigates to
`/booking/confirmation/{reference}` and **only GETs** the result. Refresh and
direct URL access must work. The frontend does not resubmit `POST /customer/bookings`.

Expected endpoint:

- `GET {API}/customer/bookings/{reference}`
- Cookie credentials included
- Backend must verify the caller owns the booking
- `401` session expired
- `403` / `404` are shown as the same not-found state (privacy)
- `404` if the confirmation read model is not connected yet

`reference` must be a public, non-sequential token in `[A-Za-z0-9_-]{1,80}`.
Do not use a numeric database id as `reference`. Do not put notes, prices,
payment tokens, Hold secrets, or resource ids in the URL.

Suggested payload:

```json
{
  "id": "apt_1",
  "reference": "BK22A",
  "status": "confirmed",
  "paymentStatus": "paid",
  "service": { "name": "ویزیت" },
  "provider": { "name": "optional public name", "mode": "specific" },
  "branch": {
    "name": "شعبه مرکزی",
    "address": "optional",
    "phone": "optional",
    "directionsUrl": "https://maps.example/place"
  },
  "startsAt": "2026-08-22T09:00:00+03:30",
  "endsAt": "2026-08-22T09:30:00+03:30",
  "timezone": "Asia/Tehran",
  "durationMinutes": 30,
  "pricing": {
    "currency": "IRR",
    "totalAmount": { "label": "۲۵۰٬۰۰۰ تومان" },
    "paidAmount": { "label": "۲۵۰٬۰۰۰ تومان" },
    "remainingAmount": { "label": "optional" }
  },
  "transactionReference": "optional public id",
  "instructions": "plain text customer instructions"
}
```

`status`: `confirmed` | `scheduled` | `pending` / `pending_confirmation` | …
`paymentStatus`: `paid` | `deposit_paid` | `pay_at_location` | `pending_payment`
| `failed` | `unpaid` | `refunded`. The UI does not infer payment status from
amounts and does not sum financial fields.

Provider `mode`: `specific` | `assigned` | `pending_assignment` / `automatic` |
`not_applicable`. Without a public name, pending assignment is shown as
«متخصص توسط مجموعه تعیین می‌شود».

Omit rooms, devices, chairs, desks, beds, allocations, Hold tokens,
`clientSecret`, and internal staff notes. HTML in instructions is stripped.

Appointment Detail (`/appointments/{id}`) is not implemented yet, so confirmation
does not link there. Dashboard remains the primary CTA.

Additional booking fields may be nested on `GET /public/services/{id}` as
`additionalFields`. Allowed types: `text`, `textarea`, `select`, `radio`,
`checkbox`, `date`. Unknown types, HTML, and file uploads are ignored until an
upload contract exists. Do not send medical/sensitive values unless marked
`sensitive`; those values stay in memory and are not written to sessionStorage.

## Customer dashboard

Authenticated customers load `/dashboard` from a single Backend aggregate.
The frontend does **not** add a Next.js aggregation route and does not invent
appointments, payment totals, or activity from unrelated endpoints.

Expected endpoint:

- `GET {API}/customer/dashboard`
- Cookie credentials included
- `401` session expired / unauthenticated
- `403` when the caller is not a customer for this business

Suggested payload (adapters also accept nested `data` / snake_case):

```json
{
  "customer": { "displayName": "نام مشتری" },
  "bookingEnabled": true,
  "nextAppointment": {
    "id": "apt_1",
    "serviceName": "ویزیت",
    "providerName": "optional public name",
    "branchName": "optional",
    "startsAt": "2026-08-22T09:00:00.000Z",
    "timezone": "Asia/Tehran",
    "durationMinutes": 30,
    "status": "confirmed",
    "paymentStatus": "paid",
    "reference": "optional"
  },
  "upcomingAppointments": [],
  "pendingAction": {
    "type": "continue_payment",
    "title": "ادامه پرداخت",
    "description": "optional",
    "href": "/payments?appointment=apt_1",
    "validUntil": "2026-08-22T10:00:00.000Z",
    "valid": true
  },
  "paymentSummary": {
    "status": "pending_payment",
    "amountLabel": "۱۵۰٬۰۰۰ تومان",
    "refundStatus": "optional",
    "continueHref": "/payments",
    "validUntil": "2026-08-22T10:00:00.000Z"
  },
  "unreadNotificationCount": 0,
  "recentNotifications": [
    {
      "id": "n1",
      "title": "plain text",
      "body": "optional plain text",
      "createdAt": "2026-08-21T10:00:00.000Z",
      "read": false,
      "href": "/appointments/apt_1"
    }
  ],
  "recentActivities": [
    {
      "id": "a1",
      "type": "appointment_created",
      "title": "نوبت ثبت شد",
      "createdAt": "2026-08-21T09:00:00.000Z"
    }
  ]
}
```

Rules for this contract:

- Designate `nextAppointment`. If it is omitted, the UI uses the first item of
  `upcomingAppointments` in Backend order.
- Keep `upcomingAppointments` in Backend order. The UI previews at most three.
- Send **Backend** appointment and payment status values. The UI does not infer
  status from unrelated fields.
- Omit rooms, devices, chairs, desks, beds, allocations, and internal notes.
- `pendingAction` must include a current `type`, customer-visible copy, a valid
  **internal** deep link, and validity (`valid` / `validUntil`). Do not send
  expired payment holds as actionable.
- Preformat money as `amountLabel`. The UI will not calculate deposits, discounts,
  or totals.
- Notification `title` / `body` must be plain text (or already sanitized). Raw
  HTML is stripped and not rendered.
- Deep links must be in-app paths such as `/appointments/{id}`. External URLs are
  discarded.
- `recentActivities` is optional. Allowed types: `appointment_created`,
  `payment_recorded`, `appointment_cancelled`, `appointment_rescheduled`,
  `refund_initiated`, `refund_completed`. If this public feed does not exist,
  omit the field; the UI will hide the section instead of assembling a fake feed.
- Widget-level failures may be nested as `{ "error": { "status": 500, "message": "...", "requestId": "..." } }`
  so one failing section does not look like an empty result.

Independent read models are acceptable later instead of the aggregate, but they
are not implemented on this Backend yet:

- next appointment
- upcoming appointments
- payment summary
- notification preview
- recent customer-visible activity

`bookingEnabled` on this payload should match public business booking. Until it
exists, the dashboard also reads `GET /public/business` for booking and contact.

## Customer appointments (Phase 14)

Authenticated customers load `/appointments` from Backend. The UI does not
classify upcoming/past/cancelled by client clock, invent appointments, or
expose internal notes/resources.

Expected endpoint:

- `GET {API}/customer/appointments?category=upcoming|past|cancelled&page=1&limit=10`
- Optional `cursor` when the Backend uses cursor pagination
- Cookie credentials included
- Backend must verify the caller owns every row
- `401` session expired
- `403` when the caller is not a customer for this business
- `404` → list API is not connected; the UI will not fake a list

Suggested payload:

```json
{
  "category": "upcoming",
  "page": 1,
  "pageCount": 2,
  "hasMore": false,
  "nextCursor": "optional-public-cursor",
  "counts": { "upcoming": 2, "past": 1, "cancelled": 0 },
  "items": [
    {
      "id": "apt_1",
      "publicReference": "apt_1",
      "status": "confirmed",
      "service": { "id": "svc_1", "name": "ویزیت" },
      "provider": { "mode": "specific", "id": "prv_1", "name": "optional public name" },
      "branch": { "id": "br_1", "name": "شعبه مرکزی" },
      "startsAt": "2026-08-22T09:00:00+03:30",
      "endsAt": "2026-08-22T09:30:00+03:30",
      "timezone": "Asia/Tehran",
      "durationMinutes": 30,
      "paymentStatus": "paid",
      "actions": {
        "canView": true,
        "canCancel": true,
        "canReschedule": true,
        "canRepeat": true,
        "canPay": false,
        "payHref": "/booking/payment",
        "payValidUntil": "2026-08-22T10:00:00.000Z",
        "processing": false,
        "blockedReason": "optional policy explanation"
      }
    }
  ]
}
```

`id` / `publicReference` must be a public non-sequential token in
`[A-Za-z0-9_-]{1,80}` (not a numeric database id).

`status` uses the same customer-visible values as confirmation
(`pending_confirmation`, `confirmed`, `scheduled`, `checked_in`, `in_progress`,
`completed`, `cancelled`, `no_show`, `rescheduled`). Do not send staff-only
statuses. Unknown statuses are dropped, not remapped.

`paymentStatus`: `paid` | `deposit_paid` | `pending_payment` | `pay_at_location`
| `failed` | `unpaid` | `refunded` | `partially_refunded`. Do not infer status
from amounts.

`actions.*` are Backend eligibility flags. If omitted, mutating actions are
hidden. `canPay` plus an expired `payValidUntil` is treated as not payable.
Cancel and reschedule routes are not implemented yet (Phases 16–17); the UI
hides those actions even when flags are true. Repeat Booking uses
`/booking?service=&provider=&branch=&repeatFrom=` and does not reuse slot,
price, coupon, quote, Hold, or payment.

Sort order is Backend-defined (nearest first for upcoming, newest first for
past). Counts are shown only when `counts` is present. Omit rooms, devices,
chairs, desks, allocations, internal notes, and staff-only fields.

This Backend currently exposes health only; this list endpoint is not mounted.

## Appointment detail (Phase 15)

Customer appointment detail is at `/appointments/{reference}`. The page GETs
owned appointment data only. The frontend does not fabricate appointments or
derive eligibility from status/time alone.

Expected endpoints:

- `GET {API}/customer/appointments/{reference}`
- Optional: `GET {API}/customer/appointments/{reference}/timeline`
- Cookie credentials included
- Backend must verify the caller owns the appointment
- `401` session expired
- `403` / `404` are shown as the same not-found state (privacy)
- `404` if the detail read model is not connected yet

`reference` must be a public, non-sequential token in `[A-Za-z0-9_-]{1,80}`.
Do not use a numeric database id as `reference`.

Suggested detail payload:

```json
{
  "id": "apt_1",
  "publicReference": "apt_1",
  "status": "confirmed",
  "service": {
    "id": "svc_1",
    "name": "ویزیت",
    "durationMinutes": 30,
    "publicDescription": "optional plain text",
    "imageUrl": "https://cdn.example/service.jpg"
  },
  "provider": { "mode": "specific", "id": "prv_1", "name": "optional public name" },
  "branch": {
    "id": "br_1",
    "name": "شعبه مرکزی",
    "address": "optional",
    "phone": "optional public phone",
    "directionsUrl": "https://maps.example/place",
    "visitInstructions": "optional floor/unit guidance"
  },
  "singleBranch": true,
  "startsAt": "2026-08-22T09:00:00+03:30",
  "endsAt": "2026-08-22T09:30:00+03:30",
  "timezone": "Asia/Tehran",
  "durationMinutes": 30,
  "paymentStatus": "paid",
  "pricing": {
    "currency": "IRR",
    "totalAmount": { "label": "۲۵۰٬۰۰۰ تومان" },
    "paidAmount": { "label": "۲۵۰٬۰۰۰ تومان" },
    "depositAmount": { "label": "optional" },
    "remainingAmount": { "label": "optional" },
    "paymentMethod": "optional label"
  },
  "transactionReference": "optional public id",
  "refundStatus": "optional",
  "receiptUrl": "optional https receipt link",
  "customerNote": "plain text customer note only",
  "timeline": [
    {
      "id": "evt_1",
      "title": "ثبت نوبت",
      "occurredAt": "2026-08-21T10:00:00+03:30",
      "state": "complete"
    }
  ],
  "cancellationPolicy": {
    "title": "optional",
    "summary": "plain text",
    "deadlineLabel": "optional",
    "feeLabel": "optional",
    "refundLabel": "optional",
    "policyUrl": "optional https link"
  },
  "reschedulePolicy": { "summary": "optional" },
  "contact": {
    "phone": "optional business phone",
    "email": "optional public email",
    "address": "optional",
    "directionsUrl": "optional",
    "hoursLabel": "optional",
    "messageUrl": "optional https contact channel"
  },
  "actions": {
    "canView": true,
    "canCancel": true,
    "canReschedule": true,
    "canRepeat": true,
    "canPay": false,
    "payHref": "/booking/payment",
    "payValidUntil": "2026-08-22T10:00:00.000Z",
    "processing": false,
    "cancelBlockedReason": "optional",
    "rescheduleBlockedReason": "optional",
    "blockedReason": "optional"
  },
  "updatedAt": "2026-08-21T12:00:00+03:30"
}
```

Never include `internalNote`, staff notes, resource allocation, room/device
codes, private Provider contact, or admin audit events in customer payloads.
If a separate timeline endpoint is used, it must return the same customer-safe
event shape. Internal events must be omitted server-side; the UI also filters
known internal kinds as defense in depth.

`customerNote` must be plain text. `actions.*` are authoritative eligibility
flags. Cancel opens `/appointments/{reference}/cancel` (Phase 16) with a fresh
Backend preview; reschedule opens `/appointments/{reference}/reschedule`
(Phase 17). Repeat Booking uses
`/booking?service=&provider=&branch=&repeatFrom=` and does not reuse slot,
price, coupon, quote, Hold, or payment.

This Backend currently exposes health only; these detail endpoints are not
mounted.

## Appointment cancellation (Phase 16)

Customer cancellation is at `/appointments/{reference}/cancel`. The page always
GETs a fresh cancellation preview before showing destructive controls. Eligibility,
policy snapshots, refund amounts, and reason codes come from Backend only. The
frontend does not calculate fees, deadlines, or refundable amounts.

Expected endpoints:

- `GET {API}/customer/appointments/{reference}/cancellation-preview`
- `POST {API}/customer/appointments/{reference}/cancellation`
- Cookie credentials included
- Backend must verify appointment ownership on preview and submit
- `401` session expired → existing session handling
- `403` / `404` on preview → same privacy-safe not-eligible state
- `409` for status/policy/refund conflicts and idempotent already-cancelled

`reference` uses the same public token rules as appointment detail.

Suggested preview payload:

```json
{
  "canCancel": true,
  "previewVersion": "pv_abc",
  "expiresAt": "2026-08-22T08:00:00+03:30",
  "blockedReason": "optional when canCancel is false",
  "appointment": {
    "publicReference": "apt_1",
    "status": "confirmed",
    "serviceName": "ویزیت",
    "startsAt": "2026-08-22T09:00:00+03:30",
    "endsAt": "2026-08-22T09:30:00+03:30",
    "timezone": "Asia/Tehran",
    "durationMinutes": 30,
    "paymentStatus": "paid",
    "provider": { "mode": "specific", "name": "optional public name" },
    "branchName": "optional branch label"
  },
  "policy": {
    "title": "optional",
    "summary": "plain text",
    "deadlineLabel": "server-formatted deadline",
    "feeLabel": "optional formatted fee",
    "refundLabel": "optional refund rule summary",
    "policyUrl": "optional https link"
  },
  "refund": {
    "status": "none|full|partial|pending_calculation|already_refunded|processing",
    "paidAmount": { "label": "optional" },
    "cancellationFee": { "label": "optional" },
    "refundableAmount": { "label": "optional" },
    "methodLabel": "optional",
    "processingEstimate": "optional",
    "note": "optional disclaimer"
  },
  "allowedReasons": [
    { "code": "schedule_conflict", "label": "تداخل زمانی" },
    { "code": "other", "label": "سایر", "requiresText": true, "maxLength": 200 }
  ],
  "reasonMaxLength": 500
}
```

Suggested cancellation request:

```json
{
  "reasonCode": "schedule_conflict",
  "reasonText": "optional plain text when required",
  "previewVersion": "pv_abc"
}
```

Include header `Idempotency-Key` on POST. Suggested success payload:

```json
{
  "appointmentReference": "apt_1",
  "status": "cancelled",
  "cancelledAt": "2026-08-21T12:00:00+03:30",
  "cancellationReference": "optional public id",
  "message": "optional plain text",
  "refund": {
    "status": "processing",
    "refundableAmount": { "label": "optional confirmed amount only" }
  }
}
```

Conflict codes the UI recognizes:

- `POLICY_CHANGED` / `CANCELLATION_POLICY_CHANGED` → refetch preview, require re-review
- `REFUND_CHANGED` / `REFUND_PREVIEW_CHANGED` → refetch preview, require re-review
- `ALREADY_CANCELLED` / `ALREADY_CANCELED` → terminal already-cancelled state
- `APPOINTMENT_STARTED`, `WINDOW_EXPIRED`, `STATUS_CHANGED`, `NOT_ELIGIBLE`

Never include internal notes, staff notes, resource allocation, or refund
calculation inputs in customer payloads. Cancellation success and refund status
must remain distinct fields.

This Backend currently exposes health only; cancellation endpoints are not
mounted.

## Appointment reschedule (Phase 17)

Customer reschedule is at `/appointments/{reference}/reschedule`. The page GETs a
fresh reschedule preview before showing date/slot selection. Eligibility, policy,
financial adjustments, and availability come from Backend only. The current
appointment remains unchanged until the Backend confirms success.

Expected endpoints:

- `GET {API}/customer/appointments/{reference}/reschedule-preview`
- `GET {API}/customer/appointments/{reference}/reschedule/availability/dates`
- `GET {API}/customer/appointments/{reference}/reschedule/availability/slots`
- `POST {API}/customer/appointments/{reference}/reschedule/quote`
- `POST {API}/customer/appointments/{reference}/reschedule`
- Cookie credentials included
- Backend must verify appointment ownership on all reads and mutations
- `401` session expired
- `403` / `404` on preview → privacy-safe not-eligible state
- `409` for slot taken, preview/policy changes, and status conflicts

Reschedule availability endpoints should exclude internal resource identifiers
and account for the existing appointment server-side. Response shapes may reuse
the public booking availability adapters (`dates`, `days`, `slots`).

Suggested preview payload:

```json
{
  "canReschedule": true,
  "previewVersion": "rpv_abc",
  "blockedReason": "optional when canReschedule is false",
  "appointment": {
    "publicReference": "apt_1",
    "status": "confirmed",
    "service": { "id": "svc_1", "name": "ویزیت" },
    "startsAt": "2026-08-22T09:00:00+03:30",
    "timezone": "Asia/Tehran",
    "provider": { "mode": "specific", "id": "prv_1", "name": "optional" },
    "branch": { "id": "br_1", "name": "شعبه مرکزی" }
  },
  "selection": {
    "serviceId": "svc_1",
    "branchId": "br_1",
    "providerPreference": { "type": "specific", "providerId": "prv_1" },
    "requiresBranch": true,
    "providerMode": "optional",
    "timezone": "Asia/Tehran"
  },
  "permissions": {
    "allowBranchChange": false,
    "allowProviderChange": false
  },
  "policy": {
    "summary": "plain text",
    "deadlineLabel": "optional",
    "feeLabel": "optional"
  },
  "remainingReschedulesLabel": "optional",
  "warning": "optional",
  "requiresAcknowledgment": false,
  "contact": { "phone": "optional" }
}
```

Suggested quote request:

```json
{
  "slotId": "slot_1",
  "date": "2026-08-25",
  "branchId": "optional",
  "providerId": "optional",
  "previewVersion": "rpv_abc"
}
```

Suggested quote response:

```json
{
  "previewVersion": "rpv_def",
  "proposed": {
    "slotId": "slot_1",
    "date": "2026-08-25",
    "startsAt": "2026-08-25T09:00:00+03:30"
  },
  "financial": {
    "status": "none|additional_payment|partial_refund|refund_pending|payment_pending|pending_calculation",
    "currentAmountLabel": "optional",
    "newAmountLabel": "optional",
    "differenceLabel": "optional",
    "depositLabel": "optional",
    "refundLabel": "optional",
    "payHref": "optional when additional payment is required",
    "holdReference": "optional",
    "expiresAt": "optional"
  },
  "policy": { "summary": "optional" },
  "warning": "optional",
  "requiresAcknowledgment": true
}
```

Reschedule submit must include header `Idempotency-Key`. Suggested body:

```json
{
  "slotId": "slot_1",
  "date": "2026-08-25",
  "branchId": "optional",
  "providerId": "optional",
  "previewVersion": "rpv_def",
  "acknowledged": true
}
```

Suggested success payload:

```json
{
  "appointmentReference": "apt_1",
  "status": "rescheduled",
  "startsAt": "2026-08-25T09:00:00+03:30",
  "financial": { "status": "none" },
  "message": "optional"
}
```

When additional payment is required before the reschedule is final, Backend may
return `paymentRequired: true` with `financial.payHref` or a hold reference that
integrates with the existing payment flow (`POST /customer/payments/sessions`).
The frontend must not invent gateway URLs or payment amounts.

Conflict codes the UI recognizes include `SLOT_TAKEN`, `PREVIEW_CHANGED`,
`POLICY_CHANGED`, `QUOTE_CHANGED`, `NOT_ELIGIBLE`, and `STATUS_CHANGED`.

Never include internal notes, resource allocation, or staff-only fields in
customer payloads.

This Backend currently exposes health only; reschedule endpoints are not
mounted.

## Customer profile and account settings (Phase 18)

Customer account UI lives at:

- `/profile`
- `/profile/edit`
- `/profile/security`
- `/profile/notifications`

Expected endpoints:

- `GET {API}/customer/profile`
- `PATCH {API}/customer/profile` body: `{ "firstName"?, "lastName"?, "email"? }`
- `POST {API}/customer/profile/phone/change` body: `{ "phone": "09XXXXXXXXX" }`
- `POST {API}/customer/profile/phone/verify` body: `{ "challengeId", "code" }`
- `POST {API}/customer/profile/phone/resend` body: `{ "challengeId" }`
- `POST {API}/customer/profile/email/change` body: `{ "email", "currentPassword"? }`
- `POST {API}/customer/profile/email/verify` body: `{ "challengeId", "code" }`
- `POST {API}/customer/profile/email/resend` body: `{ "challengeId" }`
- `GET {API}/customer/profile/notifications`
- `PATCH {API}/customer/profile/notifications` body: `{ "id", "enabled" }`
- Existing: `POST {API}/auth/password/change`
- Existing: `POST {API}/auth/logout`

Cookie credentials included. Backend must return only customer-visible fields.
Never include internal notes, tags, risk flags, cancellation analytics, or
operational assignments.

Suggested profile payload:

```json
{
  "id": "user_1",
  "firstName": "علی",
  "lastName": "رضایی",
  "displayName": "علی رضایی",
  "phone": "09121234567",
  "phoneMasked": "0912***67",
  "phoneVerified": true,
  "email": "ali@example.com",
  "emailVerified": "verified",
  "pendingEmail": "optional-pending@example.com",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "canChangePhone": true,
  "canChangeEmail": true,
  "canChangePassword": true,
  "avatarUploadSupported": false
}
```

Phone/email change challenges reuse the OTP challenge shape
(`challengeId`, `maskedDestination`, `expiresAt`, `resendAvailableAt`).

Notification preference items:

```json
{
  "items": [
    {
      "id": "n1",
      "eventKey": "appointment_reminder",
      "label": "یادآوری نوبت",
      "channel": "sms",
      "enabled": true,
      "required": true
    }
  ],
  "disclaimer": "optional"
}
```

Required preferences must remain enabled. Optional ones may be toggled.

### Not implemented in Phase 18 UI

- Avatar upload: omit until `avatarUploadSupported` and an upload contract exist
- Account deactivation: omit until a dedicated Backend eligibility/submit
  contract exists (`POST /customer/profile/deactivate` or equivalent)

This Backend currently exposes health only; profile endpoints are not mounted.

## Customer payment history (Phase 19)

Customer payment history lives at:

- `/payments`
- `/payments/{paymentReference}` (detail uses the existing ownership-checked GET)

Checkout remains at `/booking/payment` and `/booking/payment/result`.

Expected endpoints:

- `GET {API}/customer/payments`
  - Cookie credentials, ownership scoped to the authenticated customer
  - Query: `page`, `limit`, optional `status`, `q`, `appointmentId`, `from`, `to`, `cursor`
  - `status` filter values: `pending` | `processing` | `paid` | `failed` |
    `cancelled` | `expired` | `refunded` | `partially_refunded`
  - Response includes `items`, optional `page` / `pageCount` / `totalCount` /
    `hasMore` / `nextCursor`, optional `emptyHistory`
  - Do not calculate outstanding balance, fees, tax, or totals in the frontend
- `GET {API}/customer/payments/{reference}`
  - Same ownership rules as Phase 13 status GET
  - May return the richer history shape (amount, refund, appointment link, receipt)
- Optional `GET {API}/customer/payments/{reference}/receipt`
  - Returns a Backend-authorized time-limited URL such as
    `{ "url": "https://..." }`
  - Never require the frontend to build privileged storage URLs or put auth
    tokens in visible query strings

Suggested list item:

```json
{
  "id": "pay_1",
  "publicReference": "pay_1",
  "status": "paid",
  "amountLabel": "۲۵۰٬۰۰۰ تومان",
  "currency": "IRR",
  "paidAt": "2026-08-22T10:06:00.000Z",
  "transactionReference": "trx_1",
  "bookingReference": "BK22A",
  "appointmentId": "apt_1",
  "appointmentAvailable": true,
  "serviceName": "ویزیت",
  "methodLabel": "پرداخت کامل",
  "classification": "full",
  "refundStatus": "partially_refunded",
  "refundAmountLabel": "۴۰٬۰۰۰ تومان",
  "receiptUrl": "https://receipts.example/pay_1",
  "receiptAvailable": true
}
```

`status` values map through the shared StatusBadge. Unknown statuses render as
neutral «نامشخص» and are never treated as paid.

### Not implemented as customer actions in Phase 19

- Customer-initiated refund request
- Wallet / balance features
- Admin settlement or reconciliation fields

This Backend currently exposes health only; payment history list/receipt
endpoints are not mounted.

## Customer notifications (Phase 20)

Customer notification center routes:

- Header bell (popover on desktop, drawer on mobile)
- `/notifications`
- `/payments` history remains separate; notification deep links may open
  `/appointments/{ref}` or `/payments/{ref}`

Expected endpoints:

- `GET {API}/customer/notifications?page&limit&read=all|unread|read&cursor`
- `GET {API}/customer/notifications/unread-count` → `{ "unreadCount": 0 }`
- `GET {API}/customer/notifications/recent?limit=5`
  - If absent (`404`), the UI falls back to the first page of the list
- `GET {API}/customer/notifications/{id}`
- `POST {API}/customer/notifications/{id}/read`
- `POST {API}/customer/notifications/read-all`

Cookie credentials and ownership checks required. Opening the popover must not
mark items as read.

Suggested item:

```json
{
  "id": "n1",
  "type": "appointment_reminder",
  "title": "plain text",
  "message": "optional plain text",
  "createdAt": "2026-08-22T10:00:00.000Z",
  "read": false,
  "entityType": "appointment",
  "entityReference": "apt_1",
  "actionType": "view",
  "href": "/appointments/apt_1"
}
```

`type` values: `booking_confirmation` | `appointment_reminder` | `reschedule` |
`cancellation` | `payment` | `refund` | `waiting_list_offer` | `review_request` |
`system`. Unknown types render as a neutral «اعلان».

Deep links: prefer `entityType` + `entityReference`. Optional `href` is accepted
only when it is an approved internal customer path. External URLs are discarded.

Waiting-list notification entities resolve to:

- `waiting_list_offer` / `waiting_list` → `/waiting-list/offers/{ref}`
- `waiting_list_entry` (or `actionType=entry`) → `/waiting-list/{ref}`

Review notification entities resolve to:

- `review` / `review_request` → `/appointments/{ref}/review`

### Not implemented until customer routes exist

- Real-time push (SSE / WebSocket); the UI uses focus refetch + manual refresh

This Backend currently exposes health only; notification inbox endpoints are not
mounted.

## Customer waiting list (Phase 21)

Customer waiting-list routes:

- `/waiting-list` — customer entries (capability-gated)
- `/waiting-list/join` — join form (service / optional provider / optional branch /
  date & time preferences)
- `/waiting-list/[entryReference]` — entry detail + leave
- `/waiting-list/offers/[offerReference]` — slot offer, server-aware countdown,
  accept / reject

Capability flag: `waitingList` (`enabled` | `disabled` | `unknown`). UI is hidden
only when explicitly `disabled`.

Expected endpoints:

- `GET {API}/customer/waiting-list/eligibility?serviceId&branchId&date&providerId|providerPreference`
  → `{ eligible, reason?, serviceSupportsWaitingList?, capabilityEnabled? }`
- `GET {API}/customer/waiting-list?page&limit&cursor`
- `POST {API}/customer/waiting-list` (+ `Idempotency-Key`)
  body may include `serviceId`, `branchId`, `providerPreference`, `datePreference`,
  `timePreference`, `timeFrom`, `timeTo`, `note`, `contextDate`
- `GET {API}/customer/waiting-list/{entryReference}`
- `POST {API}/customer/waiting-list/{entryReference}/leave` (+ `Idempotency-Key`)
- `GET {API}/customer/waiting-list/offers/{offerReference}`
  (include `expiresAt`, preferred `serverNow`, price/deposit labels from Backend,
  `rejectKeepsEntryActive` / `rejectClosesEntry` policy flags)
- `POST {API}/customer/waiting-list/offers/{offerReference}/accept` (+ `Idempotency-Key`)
- `POST {API}/customer/waiting-list/offers/{offerReference}/reject` (+ `Idempotency-Key`)

Slots payload optional flags (booking availability):

- `waitingListJoinAllowed` or `canJoinWaitingList` — required for the Time-step
  “Join Waiting List” CTA. Empty slots alone must never enable the CTA.

Accept outcome should be one of (names flexible; adapter normalizes):

- `confirmed` + `bookingReference` → Booking Confirmation
- `hold_created` + `holdReference` → Slot Hold
- `payment_required` (+ optional hold/payment refs) → Payment flow
- `expired` | `slot_taken` | `conflict` | `already_accepted` |
  `additional_info_required`

Never include rooms, devices, chairs, desks, beds, equipment, or internal
allocation ids in waiting-list payloads.

### Backend Dependency / API Contract (open)

- Waiting-list endpoints are not mounted on the current Backend (health-only).
- Branch selector on join currently accepts a public branch id string; a full
  customer-visible branch picker should reuse the booking branch catalog when
  the Backend documents the preferred source.
- Exact accept redirect fields (`paymentReference` vs hold-only payment) should
  match the Booking Payment contract once mounted.
- Whether reject closes the entry vs keeps it active must be returned per offer;
  the UI does not invent policy.
- Rejoin guidance after leave is display-only when Backend provides copy.

## Customer appointment reviews (Phase 22)

Customer review route:

- `/appointments/{appointmentReference}/review`

Capability flag: `reviews` (`enabled` | `disabled` | `unknown`). UI is hidden only
when explicitly `disabled`.

List/detail prompts appear only when Backend sets `actions.canReview: true`
(never inferred solely from `status === completed`).

Expected endpoints:

- `GET {API}/customer/appointments/{reference}/review`
  → eligibility + constraints + optional `existingReview`
- `POST {API}/customer/appointments/{reference}/review` (+ `Idempotency-Key`)
  body: `{ "rating": number, "comment"?: string }`

Suggested eligibility payload:

```json
{
  "canReview": true,
  "alreadyReviewed": false,
  "reason": "optional customer-safe explanation when not eligible",
  "deadlineLabel": "optional",
  "deadlineAt": "2026-09-01T00:00:00.000Z",
  "publicIdentityPolicy": "optional publication identity notice",
  "businessName": "optional",
  "appointmentReference": "apt_1",
  "service": { "id": "svc_1", "name": "ویزیت" },
  "provider": { "mode": "specific", "name": "public name" },
  "branch": { "name": "optional" },
  "startsAt": "2026-08-20T09:00:00+03:30",
  "timezone": "Asia/Tehran",
  "ratingMin": 1,
  "ratingMax": 5,
  "commentRequired": false,
  "commentMinLength": 0,
  "commentMaxLength": 1000,
  "canEdit": false,
  "canDelete": false,
  "existingReview": null
}
```

Suggested submitted review:

```json
{
  "id": "rev_1",
  "rating": 4,
  "ratingMax": 5,
  "comment": "plain text only",
  "submittedAt": "2026-08-22T10:00:00.000Z",
  "moderationStatus": "pending_moderation",
  "businessResponse": "optional when supported"
}
```

`moderationStatus` values (names flexible): `submitted` |
`pending_moderation` | `published` | `rejected` | `hidden`. Unknown values
render as «نامشخص». Submission success is distinct from public publication.

Appointment list/detail actions may include:

- `canReview`
- `reviewBlockedReason`

Dashboard: if Backend sends `pendingAction` with an approved internal
`/appointments/{ref}/review` href, the existing pending-action card shows it.
No separate review prompt widget is invented on the dashboard.

Never include rooms, devices, chairs, desks, beds, equipment, phone, email,
payment, or medical fields in review payloads.

### Backend Dependency / API Contract (open)

- Review GET/POST endpoints are not mounted on the current Backend (health-only).
- Edit and delete controls are omitted until `canEdit` / `canDelete` APIs and
  product rules exist.
- Multi-dimension ratings (provider vs service vs resources) are out of scope
  unless Backend documents separate fields.
- Default rating scale in the adapter is 1–5 only when Backend omits min/max on
  an otherwise valid eligibility payload; Backend should send explicit bounds.

## Admin layout (Phase 23)

Admin routes share one shell under `/admin/*` (excluding `/admin/login`).

### Session / access

- Reuses `GET {API}/auth/session` and admin login contracts above.
- Customers with `adminPanelAccess: "denied"` see a rejection state and are not
  shown protected admin content.
- Granular `permissionCodes` filter navigation and direct route access in the UI.
  When `permissionCodes` is empty, panel access alone is enough (Backend has not
  issued codes yet).

### Proposed permission codes (UI placeholders)

These are **not** enforced against inventing Backend values. Align Backend codes
before relying on granular filtering in production:

- `admin.dashboard.view`
- `admin.appointments.view`
- `admin.calendar.view`
- `admin.waiting_list.view`
- `admin.customers.view`
- `admin.services.view`
- `admin.staff.view`
- `admin.resources.view`
- `admin.branches.view`
- `admin.payments.view`
- `admin.reports.view`
- `admin.notifications.view`
- `admin.users.view`
- `admin.roles.view`
- `admin.settings.view`
- `admin.activity_logs.view`

### Not implemented in Phase 23

- Admin notification inbox API (header shows an empty shell only)
- Admin branch selector (requires multi-branch capability + branch list API)
- Manual Booking and Schedules nav items (routes do not exist yet)
- Quick Add Appointment header action (no implemented route yet)

### Backend Dependency / API Contract (open)

- Finalize opaque permission code catalog for admin navigation.
- Optional admin notification unread count / recent list for the header menu.
- Optional branch list for the header selector when `multipleBranches` is enabled.
- Optional `jobTitle` on session user for the admin user menu.

## Admin dashboard (Phase 24)

Authenticated staff load `/admin` from a single Backend aggregate (or documented
per-widget endpoints). The frontend does **not** calculate revenue, utilization,
peak-hour buckets, cancellation rates, or growth percentages from appointment
lists.

Expected endpoint:

- `GET {API}/admin/dashboard?date=YYYY-MM-DD&from=YYYY-MM-DD&to=YYYY-MM-DD&branchId=`
- Cookie credentials included
- `401` session expired / unauthenticated
- `403` when the caller lacks `admin.dashboard.view` (or equivalent Backend code)
- `404` when the dashboard aggregate is not mounted yet

Suggested payload (adapters also accept nested `data` / snake_case):

```json
{
  "operationalDate": "2026-08-23",
  "timezone": "Asia/Tehran",
  "serverNow": "2026-08-23T08:00:00.000Z",
  "lastUpdatedAt": "2026-08-23T08:00:05.000Z",
  "branchId": "optional when filtered",
  "manualBookingEnabled": false,
  "operational": {
    "todayAppointments": { "value": 12, "trend": { "label": "+2", "tone": "positive", "comparison": "نسبت به دیروز" } },
    "upcoming": { "value": 4 },
    "needingAction": { "value": 2 },
    "completed": { "value": 6 },
    "cancelled": { "value": 1 },
    "noShow": { "value": 0 },
    "todayRevenue": { "amountLabel": "۱٬۲۰۰٬۰۰۰ ریال" }
  },
  "recentAppointments": {
    "items": [
      {
        "id": "apt_1",
        "customerName": "masked or full name from Backend",
        "serviceName": "ویزیت",
        "providerName": "optional public staff name",
        "resourceName": "optional when permitted",
        "branchName": "optional",
        "startsAt": "2026-08-23T09:00:00.000Z",
        "timezone": "Asia/Tehran",
        "status": "confirmed",
        "paymentStatus": "paid",
        "reference": "optional"
      }
    ]
  },
  "alerts": [
    {
      "id": "alert_1",
      "tone": "warning",
      "title": "۲ پرداخت ناموفق",
      "description": "optional",
      "href": "/admin/payments"
    }
  ],
  "analytics": {
    "newCustomers": { "value": 3 },
    "popularServices": {
      "items": [{ "name": "ویزیت", "countLabel": "24", "shareLabel": "۴۰٪" }]
    },
    "staffUtilization": {
      "items": [{ "id": "st_1", "name": "دکتر الف", "utilizationLabel": "۷۸٪", "barPercent": 78 }]
    },
    "resourceUtilization": {
      "items": [{ "id": "res_1", "name": "اتاق ۱", "utilizationLabel": "۶۵٪", "barPercent": 65 }]
    },
    "peakHours": {
      "items": [{ "hourLabel": "09:00", "countLabel": "8", "barPercent": 80 }]
    }
  }
}
```

Rules for this contract:

- `operationalDate` defines the **Today** context in the business timezone.
- Send integer counts for operational metrics. Valid zero must be `{ "value": 0 }`;
  omit or mark `{ "unavailable": true }` when a metric cannot be computed.
- Preformat revenue as `amountLabel`. Do not expect the UI to sum payments.
- Send Backend appointment and payment status values only. Unknown values map to a
  neutral UI fallback; they must never be silently treated as completed/confirmed.
- Mask customer contact in `customerName` unless the caller has customer PII
  permission; the UI displays Backend-provided strings as-is.
- Include `resourceName` only when the caller has resource visibility.
- `barPercent` / `utilizationLabel` must come from Backend algorithms; the UI
  renders bars but does not derive percentages from raw counts.
- Widget-level failures may be nested as
  `{ "error": { "status": 500, "message": "...", "requestId": "..." } }` on
  `recentAppointments`, `popularServices`, `staffUtilization`,
  `resourceUtilization`, or `peakHours`.
- Set `manualBookingEnabled: true` only when Phase 26 manual booking route/API
  exists; the UI still hides Quick Add until that route is implemented.
- Branch filter uses `branchId` query param and requires `GET /public/branches`
  when multi-branch is enabled.

### Backend Dependency / API Contract (open)

- Mount `GET /admin/dashboard` aggregate for operational admin home.
- Document final metric definitions (needing action, today revenue, utilization).
- Optional per-widget endpoints if aggregate is split later; keep query keys stable.
- Admin appointment detail route backing links from recent appointments.

## Admin appointment management (Phase 25)

Operational appointment list and detail for staff under `/admin/appointments`.

### List

- `GET {API}/admin/appointments?q=&date=&from=&to=&status=&paymentStatus=&serviceId=&staffId=&resourceId=&customerId=&branchId=&bookingSource=&sort=&direction=&page=&limit=`
- Server-side search, filters, sort, and pagination only
- Response should include `items`, `page`, `pageCount`, `totalCount`, `hasMore`,
  `filtersApplied`, `emptyHistory`, and optional `filterOptions` for dropdowns
- Each item should include `allowedActions` for row-level action hints

### Detail

- `GET {API}/admin/appointments/{reference}`
- `GET {API}/admin/appointments/{reference}/timeline`
- Include `customer` (masked contact when needed), `payment` labels from Backend,
  optional `resources`, separate `customerNote` and `internalNote`, `allowedActions`,
  and optional `version` / `updatedAt` for conflict detection

### Status mutations

All use `POST` with `Idempotency-Key` header and optional `version` in body:

- `POST .../confirm`
- `POST .../check-in`
- `POST .../start`
- `POST .../complete`
- `POST .../no-show` (optional `reasonCode`, `reasonText`)

Return updated `status`, `reference`, optional `message`, `version`, `updatedAt`.
Use `409` when the appointment changed concurrently.

### Admin cancellation

- `GET .../cancellation-preview`
- `POST .../cancellation` with preview version and optional reason fields

Same shape as customer cancellation preview/result; financial impact must come
from Backend only.

### Internal note

- `PATCH .../internal-note` with `{ note, version? }` and idempotency
- Permission: `admin.appointments.edit_internal_note` (opaque placeholder)
- Must never appear in customer APIs or notifications

### Admin reschedule (not mounted in Phase 25 UI flow)

- Expected future endpoints mirroring customer reschedule with admin authorization
- Until mounted, UI shows a guarded entry only (`ADMIN_APPOINTMENT_RESCHEDULE_ENABLED`)

### Backend Dependency / API Contract (open)

- Mount all list/detail/mutation endpoints above
- Document `allowedActions` rules per appointment state (Backend authoritative)
- Filter option endpoints or embed `filterOptions` in list response
- Admin reschedule availability, quote, and confirm contracts
- Customer profile deep link `/admin/customers/{id}` when supported

## Admin operational calendar (Phase 27)

Operational Day / Week / Month calendar under `/admin/calendar`.

Permission: `admin.calendar.view` (opaque placeholder). Optional
`admin.calendar.view_blocks` for block reason text. Resource columns/filters
require `admin.resources.view`.

### Visible-range fetch

- `GET {API}/admin/calendar?from=&to=&view=&groupBy=&timezone=&branchId=&staffId=&resourceId=&resourceType=&serviceId=&status=&paymentStatus=`
- `from` / `to` are inclusive ISO dates for the **visible** range only
- `view`: `day` | `week` | `month` (independent of grouping)
- `groupBy`: `general` | `staff` | `resource` | `branch` (independent of view)
- Do not return the full appointment history

### Response shape (illustrative)

```json
{
  "timezone": "Asia/Tehran",
  "weekStartsOn": 6,
  "slotIntervalMinutes": 15,
  "serverNow": "2026-08-25T09:00:00.000Z",
  "lastUpdatedAt": "2026-08-25T09:00:00.000Z",
  "workingHours": [{ "dayOfWeek": 2, "start": "09:00", "end": "18:00" }],
  "closedPeriods": [{ "date": "2026-08-26", "reason": "تعطیل رسمی", "allDay": true }],
  "columns": [{ "id": "st_1", "label": "دکتر الف", "kind": "staff" }],
  "events": [
    {
      "id": "ev_1",
      "type": "appointment",
      "startsAt": "...",
      "endsAt": "...",
      "columnId": "st_1",
      "customerName": "سارا",
      "serviceName": "ویزیت",
      "status": "confirmed",
      "paymentStatus": "paid",
      "appointmentReference": "REF-1"
    },
    {
      "id": "ev_2",
      "type": "blocked_time",
      "startsAt": "...",
      "endsAt": "...",
      "columnId": "st_1",
      "blockReason": "تعمیر"
    },
    {
      "id": "ev_3",
      "type": "time_off",
      "startsAt": "...",
      "endsAt": "...",
      "columnId": "st_1",
      "timeOffLabel": "مرخصی"
    }
  ],
  "daySummaries": [{ "date": "2026-08-25", "appointmentCount": 4, "density": "medium" }],
  "filterOptions": {
    "staff": [{ "id": "st_1", "name": "دکتر الف" }],
    "resources": [{ "id": "res_1", "name": "اتاق ۱", "type": "room" }],
    "resourceTypes": [{ "value": "room", "label": "اتاق" }],
    "services": [],
    "branches": []
  },
  "filtersApplied": false,
  "emptyHistory": false,
  "errors": {
    "blockedTime": { "message": "optional partial failure" }
  }
}
```

Rules:

- Working hours, closed periods, slot interval, week start, and timezone come
  from Backend / settings — the UI does not hardcode them.
- Appointment status and payment status stay separate fields.
- Unknown statuses map to a neutral UI fallback.
- Mask or omit `blockReason` when the caller lacks block-reason permission.
- Include `resourceName` / resource columns only when authorized.
- Partial failures may nest under `errors.blockedTime` / `errors.timeOff`
  without failing the whole calendar.
- Month view prefers `daySummaries` counts; do not expand full resource
  allocations in month cells.

### Drag & Drop (future — not in Phase 27)

Requires separate product approval and Backend validation for:

- Permission to move/resize
- Candidate slot validation
- Availability and resource re-validation
- Financial / policy preview
- Explicit confirmation
- Conflict handling and rollback

The UI sets `ADMIN_CALENDAR_DRAG_DROP_ENABLED = false` and does not enable
draggable interactions.

### Backend Dependency / API Contract (open)

- Mount `GET /admin/calendar` visible-range aggregate
- Document event type enum and column `kind` values
- Document `weekStartsOn` and business-hours timezone rules
- Optional SSE/WebSocket later; Phase 27 uses query refetch only

## Admin resource management (Phase 28)

Unified operational resources under `/admin/resources` (list, create, edit,
detail). Calendar entry at `/admin/resources/{reference}/calendar` redirects to
Phase 27 `/admin/calendar?group=resource&resource={id}`.

Permissions (opaque placeholders):

- `admin.resources.view`
- `admin.resources.create`
- `admin.resources.edit`
- Optional lifecycle: deactivate / archive / delete gated by payload
  `allowedActions` and Backend authorization

Staff profile, specialty, employment, leave, and performance stay in Phase 29.
Creating `type=staff` via the generic resource form is intentionally omitted;
staff may still appear as list/detail rows when Backend returns them as
unified availability resources, with a link to `/admin/staff/{staffReference}`.

Internal types (`room`, `device`, `desk`, `chair`, `bed`, `equipment`, `other`)
must never be treated as customer-visible providers. The UI only sends
`customerVisible` for `staff` when Backend allows it.

### List

- `GET {API}/admin/resources?q=&type=&branchId=&serviceId=&active=&sort=&direction=&page=&limit=`
- Server-side search, type/branch/active/service filters, sort allowlist,
  pagination
- Distinguish empty catalog vs filtered no-results (`emptyCatalog` /
  `filtersApplied` when provided)
- Embed optional `filterOptions` for type/branch/service selects

### Detail

- `GET {API}/admin/resources/{reference}`
- Include lifecycle, capacity semantics (`min`/`max`/`editable`/`semanticsLabel`),
  schedule inheritance summary (mode + working hours / breaks / time-off /
  block summaries), related services, version/ETag, and `allowedActions`
- Unknown `type` / lifecycle must map to a neutral UI fallback

### Create / update

- `POST {API}/admin/resources` with `Idempotency-Key`
- `PATCH {API}/admin/resources/{reference}` with `Idempotency-Key`
- Body fields used by UI: `type`, `name`, `description`, `capacity`, `branchId`,
  `scheduleMode`, optional `customerVisible` (staff only), `version`
- Do not accept asset-management fields (serial, maintenance, inventory) in
  this phase
- Concurrent updates: return `409` with conflict/version codes; UI refetches
  and does not silently merge
- Duplicate: return `409` with duplicate/exists codes

### Impact-sensitive lifecycle

Before deactivate / activate / archive / delete / branch change:

- `POST {API}/admin/resources/{reference}/impact-preview`
  body: `{ action, branchId?, version? }`
- Confirm with:
  - `POST .../deactivate` | `/activate` | `/archive` | `/delete` | `/branch`
  body: `{ previewVersion?, version?, branchId? }` + `Idempotency-Key`
- Prefer deactivation/archive over delete when history exists
- UI does not optimistically flip status switches

### Schedule inheritance

Supported modes (summaries only in Phase 28):

- `inherit_business`
- `inherit_branch`
- `custom`

Full working-hours / break / time-off / block editors remain Phase 32
(`ADMIN_RESOURCE_SCHEDULE_EDITOR_ENABLED = false`).

### Response shape (illustrative)

```json
{
  "items": [
    {
      "id": "res_1",
      "reference": "ROOM-1",
      "name": "اتاق ۱",
      "type": "room",
      "lifecycle": "active",
      "capacity": { "value": 1, "min": 1, "max": 4, "editable": true, "semanticsLabel": "هم‌زمان" },
      "branch": { "id": "br_1", "name": "شعبه مرکزی" },
      "schedule": {
        "mode": "inherit_business",
        "sourceLabel": "از برنامه کسب‌وکار",
        "workingHoursLabel": "۹–۱۸",
        "breaksLabel": "۱۲–۱۳",
        "timeOffLabel": "بدون مرخصی",
        "blockTimeLabel": "بدون مسدودی"
      },
      "relatedServiceCount": 2,
      "allowedActions": { "edit": true, "deactivate": true, "viewCalendar": true }
    }
  ],
  "page": 1,
  "pageCount": 1,
  "totalCount": 1,
  "filtersApplied": false,
  "emptyCatalog": false,
  "filterOptions": {
    "types": [{ "value": "room", "label": "اتاق" }],
    "branches": [],
    "services": []
  }
}
```

### Backend Dependency / API Contract (open)

- Mount unified `GET/POST/PATCH /admin/resources` and lifecycle/impact endpoints
- Document resource type enum, capacity semantics per type, and which types may
  set `customerVisible`
- Document schedule mode inheritance and summary fields
- Document impact-preview contract for deactivate/archive/delete/branch change
- Document version/ETag conflict behavior
- Confirm whether staff rows are created only via Phase 29 Staff APIs
- Phase 32 schedule editor entry points when available

## Admin staff management (Phase 29)

Staff / personnel under `/admin/staff`. Calendar at
`/admin/staff/{reference}/calendar` redirects to Phase 27
`/admin/calendar?group=staff&staff={id}`. Performance at
`/admin/staff/{reference}/performance` only when Backend exposes metrics and
`capabilities.hasPerformance`.

Keep entity boundaries:

- **Staff** — person employed by the business
- **Bookable Provider** — staff who may be assigned to appointments (`bookable`)
- **Customer-visible Provider** — staff who may appear in customer UI (`customerVisible`)
- **Admin User** — separate authenticated account (`adminUserReference`)
- **Resource** — unified scheduling reference (`resourceReference`); not a duplicate record

Permissions (opaque placeholders):

- `admin.staff.view`
- `admin.staff.create`
- `admin.staff.edit`
- `admin.staff.view_private_contact`
- `admin.staff.view_performance`
- Lifecycle via payload `allowedActions` + Backend authorization

### List

- `GET {API}/admin/staff?q=&active=&branchId=&serviceId=&jobTitle=&specialty=&customerVisible=&bookable=&sort=&direction=&page=&limit=`
- Server-side search, filters, sort allowlist, pagination
- Embed optional `filterOptions`

### Detail

- `GET {API}/admin/staff/{reference}`
- Separate `jobTitle` and `specialty`
- `customerVisible` and `bookable` are independent booleans
- Mask `privateContact` unless caller has `admin.staff.view_private_contact`
- Schedule inheritance summaries only (Phase 32 editors deferred)
- Optional `resourceReference`, `adminUserReference`, avatar URL

### Create / update

- `POST {API}/admin/staff` with `Idempotency-Key`
- `PATCH {API}/admin/staff/{reference}` with `Idempotency-Key`
- Body: name, firstName, lastName, jobTitle, specialty, publicDescription, phone,
  email, branchIds, primaryBranchId, serviceIds, customerVisible, bookable,
  scheduleMode, version
- Service assignment does **not** imply customer visibility

### Avatar upload (when supported)

- `POST {API}/admin/staff/{reference}/avatar` — multipart `avatar` field
- `DELETE {API}/admin/staff/{reference}/avatar`
- Backend returns updated staff detail; UI never constructs privileged upload URLs

### Impact-sensitive lifecycle

- `POST .../impact-preview` body: `{ action, branchId?, serviceId?, version? }`
- Confirm: `POST .../deactivate|activate|archive|delete|branch|service`
- No optimistic status switches

### Performance (optional)

- `GET {API}/admin/staff/{reference}/performance`
- Backend-calculated metrics only; UI does not aggregate from appointment pages

### Response shape (illustrative)

```json
{
  "items": [
    {
      "id": "st_1",
      "reference": "ST-1",
      "name": "دکتر الف",
      "jobTitle": "پزشک",
      "specialty": "عمومی",
      "lifecycle": "active",
      "customerVisible": true,
      "bookable": true,
      "branches": [{ "id": "br_1", "name": "مرکزی", "primary": true }],
      "services": [{ "id": "svc_1", "name": "ویزیت" }],
      "schedule": {
        "mode": "inherit_branch",
        "workingHoursLabel": "۹–۱۸",
        "breaksLabel": "۱۲–۱۳",
        "leaveLabel": "بدون مرخصی"
      },
      "resourceReference": "res_st_1",
      "allowedActions": {
        "edit": true,
        "deactivate": true,
        "viewCalendar": true,
        "viewPrivateContact": true,
        "uploadAvatar": true
      }
    }
  ],
  "filterOptions": { "branches": [], "services": [], "jobTitles": [], "specialties": [] }
}
```

### Backend Dependency / API Contract (open)

- Mount unified `GET/POST/PATCH /admin/staff` and lifecycle/impact endpoints
- Document Staff ↔ Resource ↔ Admin User linking rules
- Document avatar upload contract (size/type, storage, signed URLs if any)
- Document performance metrics schema and permission gate
- Document private contact field visibility rules
- Phase 32 schedule editor entry points when available

## Admin service resource mapping (Phase 30)

Per-service operational resource requirements at
`/admin/services/{serviceReference}/resources`.

The UI configures requirements; Backend performs matching, allocation,
availability, capacity, and Slot generation. Customers see only valid Slots and
optional customer-visible Providers.

Permissions:

- `admin.services.view` — read mapping
- `admin.services.manage_resources` or `admin.services.edit` — edit mapping

### Semantics (must be documented by Backend)

| Field | Meaning |
| --- | --- |
| `necessity: required` | Absence prevents valid booking/Slot |
| `necessity: optional` | Absence does not prevent booking |
| `selectionMode: any_of_type` | Backend allocates any active eligible resource of `resourceType` |
| `selectionMode: specific` | Backend must choose from `resourceIds` / `selectedResources` |
| `selectionSemantics: any_one` | Selected items are alternatives (OR) |
| `selectionSemantics: all` | All selected items required simultaneously (AND) |
| `quantity` | Count of resources required — **not** capacity or service throughput |
| `providerSelectable` (staff) | Customer may select this human provider when Backend allows |
| `branchScope` | `global` \| `branch` \| `inherited` |

**Provider vs Staff:** Staff type requirements are not automatically
customer-visible. `providerSelectable` is independent of service assignment.

### Endpoints

- `GET {API}/admin/services/{serviceReference}/resource-requirements`
- `PUT {API}/admin/services/{serviceReference}/resource-requirements` (+ `Idempotency-Key`, optional `version`)
- `POST {API}/admin/services/{serviceReference}/resource-requirements/impact-preview`
- `GET {API}/admin/services/{serviceReference}/resource-requirements/eligible-resources?type=&branchId=`

### Save body (illustrative)

```json
{
  "version": "v3",
  "requirements": [
    {
      "reference": "req_1",
      "resourceType": "staff",
      "quantity": 1,
      "necessity": "required",
      "selectionMode": "any_of_type",
      "staffRole": "تکنسین MRI",
      "providerSelectable": false,
      "branchScope": "global",
      "sortOrder": 1
    },
    {
      "resourceType": "device",
      "quantity": 1,
      "necessity": "required",
      "selectionMode": "specific",
      "resourceIds": ["dev_a", "dev_b"],
      "branchScope": "branch",
      "branchId": "br_1",
      "sortOrder": 2
    }
  ]
}
```

Rules:

- Never expose requirement summary or internal resource names in customer
  `/public/services` or booking payloads.
- Duplicate resource types in one scope are not auto-invalid; Backend validates.
- Inactive resources must be rejected or omitted from eligible lists.
- Concurrent updates: return `409` with version conflict; UI refetches.

### Backend Dependency / API Contract (open)

- Mount resource-requirements CRUD and impact-preview endpoints
- Document `selectionSemantics` for specific mode (OR vs AND) authoritatively
- Document branch inheritance/override rules
- Document staff role vs provider-selectable behavior
- Confirm atomic vs partial save semantics (`capabilities.atomicSave`)
- Document eligible-resources filtering (type, branch, active state)

## Admin service management (Phase 31)

Full Service CRUD at `/admin/services`, `/admin/services/new`,
`/admin/services/{reference}`, `/admin/services/{reference}/edit`.
Resource requirements reuse Phase 30 at `.../resources` and in the edit form tab.

Permissions (granular when Backend provides codes):

- `admin.services.view` — list/detail
- `admin.services.create` — create
- `admin.services.edit` / `admin.services.edit_content` — customer-facing fields
- `admin.services.manage_pricing` — price/deposit
- `admin.services.manage_providers` / `admin.services.manage_branches`
- `admin.services.manage_resources` — Phase 30 mapping (Phase 30)
- `admin.services.change_status` / lifecycle actions

### Endpoints

- `GET {API}/admin/services?q=&active=&branchId=&providerId=&resourceType=&sort=&direction=&page=&limit=`
- `GET {API}/admin/services/{reference}`
- `POST {API}/admin/services` (+ `Idempotency-Key`)
- `PATCH {API}/admin/services/{reference}` (+ `Idempotency-Key`, optional `version`)
- `POST {API}/admin/services/{reference}/impact-preview` — form or lifecycle preview
- `POST {API}/admin/services/{reference}/activate|deactivate|archive`
- `DELETE {API}/admin/services/{reference}` — only when API explicitly allows
- `POST {API}/admin/services/{reference}/image` (multipart), `DELETE .../image`
- `POST {API}/admin/services/reorder` — atomic sort order when supported

### Monetary contract

- Integer minor units or whole currency units only (e.g. IRR)
- Prefer backend `priceLabel` / `depositLabel` on read
- Deposit modes: `none`, `fixed`, `percentage` — UI does not compute percent-of-price
- No frontend tax/discount/final-price calculation

### Operational fields (impact-sensitive)

Duration, buffers, capacity, branch/provider assignment, resource requirements,
and active/inactive/archive may trigger impact preview before save/action.

Customer preview uses public `ServiceCard` model — excludes internal resources,
buffers, and requirement details.

### Backend Dependency / API Contract (open)

- Mount admin service CRUD endpoints
- Document capacity semantics (service vs resource vs requirement quantity)
- Document provider mode (`selectable` / `auto` / `none`) vs internal staff requirements
- Document branch assignment and single-branch hiding rules
- Confirm image upload limits and CDN URL shape
- Document reorder API and conflict/version rules

## Phase 32 — Working Hours and Schedule Management UI

Shared schedule editor at `/admin/schedules/*` for **business**, **branch**,
**staff**, and **resource** scopes. One `AdminScheduleEditorScreen` — no
parallel editors per entity type.

### Routes (mounted)

- `/admin/schedules` — hub
- `/admin/schedules/business`
- `/admin/schedules/branches/{branchReference}`
- `/admin/schedules/staff/{staffReference}`
- `/admin/schedules/resources/{resourceReference}`
- `/admin/schedules/holidays`

Deep links from staff/resource detail (`ویرایش زمان‌بندی`) and calendar
(`viewCalendar` / existing Phase 27 calendar).

### Expected Backend endpoints

- `GET {API}/admin/schedules/business`
- `GET {API}/admin/schedules/branches/{reference}`
- `GET {API}/admin/schedules/staff/{reference}`
- `GET {API}/admin/schedules/resources/{reference}`
- `PUT {API}/admin/schedules/{scope-path}` (+ `Idempotency-Key`, `version`, optional `previewVersion`)
- `POST {API}/admin/schedules/{scope-path}/impact-preview`
  body: `{ action, ... }` where `action` ∈
  `update_weekly` | `switch_inheritance` | `create_holiday` | `delete_holiday` |
  `create_time_off` | `delete_time_off` | `create_block` | `delete_block`
- `GET|POST {API}/admin/schedules/holidays`
- `DELETE {API}/admin/schedules/holidays/{id}`
- `POST|DELETE {API}/admin/schedules/{scope-path}/time-off[/{id}]`
- `POST|DELETE {API}/admin/schedules/{scope-path}/blocks[/{id}]`

### Response shape (illustrative)

```json
{
  "scopeName": "دکتر رضایی",
  "inheritanceMode": "custom",
  "timezone": "Asia/Tehran",
  "weekly": {
    "items": [
      {
        "weekday": 1,
        "closed": false,
        "intervals": [{ "start": "09:00", "end": "17:00" }],
        "breaks": [{ "start": "12:00", "end": "13:00" }]
      }
    ]
  },
  "effective": {
    "inheritanceMode": "custom",
    "sourceLabel": "سفارشی",
    "weeklySummary": ["دوشنبه ۹–۱۷"],
    "activeSpecialDays": [],
    "activeOverrides": []
  },
  "specialDays": [],
  "holidays": [],
  "timeOff": [],
  "blocks": [],
  "capabilities": {
    "supportsBreaks": true,
    "supportsCopyDay": true,
    "supportsImpactPreview": true,
    "supportsOvernightIntervals": false,
    "supportsAnnualHolidayRecurrence": false,
    "overrideSemantics": "replace",
    "overrideSemanticsLabel": "جایگزینی کامل برنامه هفتگی",
    "atomicSave": true
  },
  "allowedActions": {
    "edit": true,
    "manageWeekly": true,
    "manageHolidays": true,
    "manageTimeOff": true,
    "manageBlocks": true,
    "switchInheritance": true,
    "viewCalendar": true
  },
  "version": "v1"
}
```

### Inheritance / override semantics

- `inheritanceMode`: `inherit_business` | `inherit_branch` | `custom`
- Weekly editor enabled only when `custom` (Backend authoritative for effective schedule)
- Switching from `custom` → inherited may discard/deactivate custom data — UI confirms before `switch_inheritance` impact preview
- `overrideSemantics` on capabilities: `replace` | `merge` — UI explains Backend meaning for special days/overrides; **does not** compute effective inheritance locally

### Distinct concepts (do not collapse)

| Concept | UI treatment |
|---------|----------------|
| Working hours | Recurring weekly intervals |
| Break | Recurring inside working hours |
| Holiday | Date-based closure (business/branch scope) |
| Special day | Date with nonstandard hours |
| Schedule override | Backend-defined date adjustment |
| Time off | Staff/resource unavailability |
| Block time | Operational block; unblock = delete block record |

### Impact preview

Before sensitive saves, UI calls `impact-preview` when `capabilities.supportsImpactPreview`.
Shows affected appointment counts/warnings; no optimistic merge; `409` → refetch.

### Permissions (opaque codes)

- `admin.schedules.business.view|edit`
- `admin.schedules.branch.view|edit`
- `admin.schedules.staff.view|edit|time_off.manage|blocks.manage`
- `admin.schedules.resource.view|edit|time_off.manage|blocks.manage`
- `admin.schedules.holidays.manage`

When `permissionCodes` is empty, nav/items follow existing admin fallback (panel access).

### Cache invalidation (frontend)

After mutation: schedule detail/hub/holidays, scoped staff/resource detail,
`availability.*`, `admin/calendar`, manual booking (when availability affected),
`publicBusiness` (holidays), dashboard.

### Backend Dependency / API Contract (open)

- Mount all schedule endpoints above
- Document whether special days **replace** or **merge** with weekly schedule
- Document overnight interval support flag
- Document annual holiday recurrence support
- Document atomic weekly save vs partial day updates
- Return effective schedule summary on every GET (not computed in frontend)
- Wire calendar feed to include working hours, breaks, time off, blocks (Phase 27 integration)
- Enforce granular permissions server-side (403)

## Phase 33 — Admin Branch Management UI

Branches are **locations of one business**, not tenants. Multi-branch UI is gated by
`multipleBranches` capability **and** `publicBusiness.branchesEnabled === true`.
Single-branch businesses hide branch management nav and auto-select the sole branch in booking.

### Routes (mounted)

- `/admin/branches` — list (search/filter/sort/pagination via URL)
- `/admin/branches/new` — create
- `/admin/branches/{branchReference}` — detail (contact, schedule summary, assignments, lifecycle)
- `/admin/branches/{branchReference}/edit` — edit form
- `/admin/branches/{branchReference}/calendar` — redirect to Phase 27 calendar (`?branch=&group=branch`)
- `/admin/branches/{branchReference}/schedule` — reuses Phase 32 `AdminScheduleBranchScreen`

Deep link to Phase 32 schedule editor: `/admin/schedules/branches/{branchReference}`.

### Expected Backend endpoints

- `GET {API}/admin/branches` — list with `q`, `active`, `sort`, `direction`, `page`, `limit`
- `POST {API}/admin/branches` (+ `Idempotency-Key`) — create
- `GET {API}/admin/branches/{reference}` — detail with assignments, schedule summary, warnings
- `PATCH {API}/admin/branches/{reference}` (+ `Idempotency-Key`, `version`) — update contact/schedule mode
- `POST {API}/admin/branches/{reference}/impact-preview`
  body: `{ action, staffId?, resourceId?, serviceId?, version? }` where `action` ∈
  `activate` | `deactivate` | `archive` | `delete` |
  `assign_staff` | `remove_staff` | `assign_resource` | `transfer_resource` | `remove_resource` |
  `assign_service` | `remove_service`
- `POST {API}/admin/branches/{reference}/{activate|deactivate|archive|delete}` — lifecycle
- `POST {API}/admin/branches/{reference}/staff` — assign staff
- `POST {API}/admin/branches/{reference}/staff/remove` — remove staff (does not delete staff record)
- `POST {API}/admin/branches/{reference}/resources` — assign resource
- `POST {API}/admin/branches/{reference}/resources/transfer` — transfer resource between branches
- `POST {API}/admin/branches/{reference}/resources/remove` — remove resource from branch
- `POST {API}/admin/branches/{reference}/services` — assign/activate service at branch
- `POST {API}/admin/branches/{reference}/services/remove` — remove service from branch

### Response shape (illustrative — detail)

```json
{
  "id": "br_1",
  "reference": "BR-1",
  "name": "شعبه مرکزی",
  "publicTitle": "کلینیک مرکزی",
  "address": "تهران، …",
  "phone": "+982112345678",
  "location": { "latitude": 35.7, "longitude": 51.4, "mapUrl": "https://…" },
  "timezone": "Asia/Tehran",
  "lifecycle": "active",
  "schedule": {
    "mode": "inherit_business",
    "sourceLabel": "از ساعات کسب‌وکار",
    "workingHoursLabel": "شنبه–پنجشنبه ۹–۱۸",
    "holidaysLabel": "بدون تعطیل اضافه"
  },
  "staff": [{ "id": "st_1", "reference": "ST-1", "name": "…", "scheduleCompatible": true }],
  "resources": [{ "id": "res_1", "reference": "RES-1", "name": "اتاق ۱" }],
  "services": [{ "id": "svc_1", "reference": "SVC-1", "name": "ویزیت", "feasible": true }],
  "operationalWarnings": [],
  "capabilities": {
    "supportsTimezoneEdit": false,
    "supportsLocationCoordinates": true,
    "supportsMapUrl": true,
    "supportsImpactPreview": true,
    "supportsServiceFeasibilityCheck": true
  },
  "allowedActions": {
    "edit": true,
    "assignStaff": true,
    "assignResources": true,
    "assignServices": true,
    "manageSchedule": true,
    "viewCalendar": true,
    "deactivate": true
  },
  "version": "v1"
}
```

### Feature gating

| Mode | UI behavior |
|------|-------------|
| `branchesEnabled: false` | Hide `/admin/branches` nav; no branch selectors; booking auto-selects sole branch |
| `branchesEnabled: true` + capability | Full branch management |
| Inactive branch | Hidden from customer booking; admin may still view with permission |

### Branch operational context

Admin modules use validated URL param `branch` (same as dashboard/calendar filters).
Changing branch cancels stale requests via React Query `signal`. Branch context is a **filter**, not a security boundary.

### Customer booking

Branch step shown only when multiple active bookable branches exist for the selected service.
Single valid branch auto-selected and shown in summary. Frontend does **not** compute slot feasibility.

### Permissions (opaque codes)

- `admin.branches.view`
- `admin.branches.create`
- `admin.branches.edit`
- `admin.branches.assign`
- `admin.branches.lifecycle`

Schedule permissions reuse Phase 32 (`admin.schedules.branch.view|edit`).

### Cache invalidation (frontend)

| Change | Invalidates |
|--------|-------------|
| Contact only (name/address/phone/location) | Branch list/detail, `publicBranches` — **not** availability |
| Schedule/status/assignments/lifecycle | Availability, calendar, manual booking, schedules, staff/resources/services, dashboard |

### Backend Dependency / API Contract (open)

- Mount all branch CRUD and assignment endpoints above
- Return `feasible` + `warning` per service assignment (Backend validates staff/resources/schedule)
- Resource transfer must preview future appointments, service mappings, and calendar impact
- Staff remove-from-branch must preserve multi-branch semantics (staff record remains)
- Lifecycle deactivate/archive/delete must preview appointments, waiting list, assignments
- Document when `timezone` edit is allowed per business policy
- Return `409` with version conflict on concurrent PATCH/lifecycle
- Public branch list for customer booking: active + bookable only
- Confirm coordinate/map URL fields vs structured address separation

## Phase 34 — Admin Customer Management UI

Operational customer management for **one business** — not a CRM, medical records,
or cross-tenant directory. Internal notes, tags, and admin metrics never appear in
customer-facing pages, notifications, or caches.

### Routes (mounted)

- `/admin/customers` — list (server-side search/filter/sort/pagination)
- `/admin/customers/new` — create (reuses Manual Booking validation)
- `/admin/customers/{customerReference}` — detail (tabs: overview, appointments, payments, notes)
- `/admin/customers/{customerReference}/edit` — edit profile

Appointment history reuses Phase 25 `AdminAppointmentListTable` via `customerId` filter.
Payment history reuses `PaymentHistoryListView` adapter with admin links.

### Expected Backend endpoints

- `GET {API}/admin/customers?q=&active=&upcoming=&lastVisitFrom=&lastVisitTo=&serviceId=&branchId=&tagId=&sort=&direction=&page=&limit=`
- `GET {API}/admin/customers/search?q=` — typeahead (Manual Booking, Phase 26)
- `POST {API}/admin/customers` (+ `Idempotency-Key`) — create with duplicate detection
- `GET {API}/admin/customers/{reference}` — detail with metrics, upcoming appointment, notes, tags
- `PATCH {API}/admin/customers/{reference}` (+ `Idempotency-Key`, `version`) — profile edit
- `GET {API}/admin/customers/{reference}/payments?page=&limit=` — payment history
- `POST {API}/admin/customers/{reference}/notes` — append internal note
- `PUT {API}/admin/customers/{reference}/tags` — assign tag set
- `POST {API}/admin/customers/{reference}/impact-preview` body: `{ action, version?, reason? }`
  where `action` ∈ `block` | `unblock` | `deactivate` | `activate`
- `POST {API}/admin/customers/{reference}/{block|unblock|deactivate|activate}`

Appointment history: `GET {API}/admin/appointments?customerId={id}` (Phase 25).

### Response shape (illustrative — detail)

```json
{
  "id": "c_1",
  "reference": "C-1",
  "displayName": "سارا رضایی",
  "firstName": "سارا",
  "lastName": "رضایی",
  "lifecycle": "active",
  "phone": "09121234567",
  "phoneMasked": "0912***4567",
  "emailMasked": "sa***@example.com",
  "metrics": {
    "totalVisits": 12,
    "cancellationCount": 2,
    "noShowCount": 1,
    "periodLabel": "از ابتدا"
  },
  "upcomingAppointment": {
    "id": "ap_1",
    "reference": "REF-1",
    "startsAt": "2026-09-01T10:00:00Z",
    "status": "confirmed",
    "serviceName": "ویزیت"
  },
  "tags": [{ "id": "tag_1", "name": "VIP", "color": "default" }],
  "notes": [{ "id": "n1", "body": "یادداشت داخلی", "authorLabel": "ادمین", "createdAtLabel": "۱۴۰۴/۰۶/۰۱" }],
  "notesModel": "append",
  "allowedActions": {
    "viewFullPhone": true,
    "manageNotes": true,
    "manageTags": true,
    "viewPayments": true,
    "block": true
  },
  "capabilities": {
    "supportsNotesAppend": true,
    "supportsImpactPreview": true,
    "supportsVerifiedContactOverride": false
  },
  "version": "v1"
}
```

### Privacy and masking

| Permission | UI behavior |
|------------|-------------|
| `admin.customers.view` | List/detail without full contact |
| `admin.customers.view_contact` | Full phone/email in detail; copy when allowed |
| `admin.customers.notes` | Internal notes panel |
| `admin.customers.tags` | Tag assign/remove |
| `admin.customers.block` / `deactivate` | Lifecycle with impact preview |

Search uses generic `q` URL param (debounced); phone/email not logged in frontend.

### Metrics

`totalVisits`, `cancellationCount`, `noShowCount` are **Backend-calculated only**.
UI shows `—` or `نامشخص` when unavailable — never derives from paginated history.

### Cache invalidation (frontend)

| Mutation | Invalidates |
|----------|-------------|
| Profile/contact edit | Customer list/detail, manual booking search, customer profile (public fields only) |
| Notes/tags | Admin customer detail only — **not** customer-facing caches |
| Block/deactivate | Appointments, calendar, waiting list, availability |

### Backend Dependency / API Contract (open)

- Mount list/detail CRUD and lifecycle endpoints above
- Return `upcomingAppointment` on detail GET (not computed from history page)
- Duplicate detection on create with `existingCustomer` payload
- Document verified contact override policy and audit requirements
- Internal notes append-only vs editable model flag (`notesModel`)
- Tag catalog for assign UI (`availableTags` or `filterOptions.tags`)
- Payment history endpoint or document reuse of admin payments filter by customer
- Block vs deactivate semantics and required `reason` fields
- `409` version conflict on concurrent PATCH/lifecycle
- Never include internal notes/tags in customer or public APIs

## Phase 35 — Admin Payments Management UI

Operational payment management for **one business** — not a marketplace billing
platform, payout system, or multi-tenant accounting product. Payment, transaction,
appointment balance, deposit, refund, and revenue remain **Backend-authoritative**.
The browser never calculates balances, refundable amounts, or net revenue.

### Routes (mounted)

- `/admin/payments` — list (server-side search/filter/sort/pagination)
- `/admin/payments/{paymentReference}` — detail with refund/manual payment actions

Customer payment history tab (Phase 34) links to admin payment detail.
Appointment detail payment block links via `routes.admin.paymentDetail`.

### Expected Backend endpoints

- `GET {API}/admin/payments?q=&status=&refundStatus=&method=&appointmentId=&customerId=&branchId=&from=&to=&sort=&direction=&page=&limit=`
- `GET {API}/admin/payments/{reference}` — detail with timeline, allowedActions, capabilities
- `GET {API}/admin/payments/summary?{same filters except page/sort}` — revenue summary (optional; `404` omits module)
- `GET {API}/admin/payments/{reference}/receipt` — receipt URL (optional)
- `POST {API}/admin/payments/{reference}/refund-preview` — eligibility/max refundable/policy
- `POST {API}/admin/payments/{reference}/refund` (+ `Idempotency-Key`) — issue refund
- `GET {API}/admin/payments/manual-options?appointmentId=` — manual payment methods/constraints
- `POST {API}/admin/payments/manual` (+ `Idempotency-Key`) — record manual payment

Per-customer history: `GET {API}/admin/customers/{reference}/payments` (Phase 34) may
mirror list item shape; global list is preferred for admin payments screen.

### Response shape (illustrative — list item)

```json
{
  "publicReference": "PAY-1",
  "transactionReference": "TX-1",
  "status": "paid",
  "refundStatus": "none",
  "amountLabel": "۲۵۰٬۰۰۰ تومان",
  "methodLabel": "آنلاین",
  "classificationLabel": "بیعانه",
  "paidAt": "2026-08-22T10:00:00Z",
  "customer": { "reference": "C-1", "displayName": "سارا", "phoneMasked": "0912***4567" },
  "appointment": { "reference": "APT-1", "serviceName": "ویزیت", "startsAt": "..." },
  "branch": { "reference": "B-1", "name": "شعبه مرکزی" },
  "allowedActions": { "issueRefund": true, "downloadReceipt": true }
}
```

### Detail extras

- `remainingBalanceLabel` — appointment balance from Backend (not computed in UI)
- `timeline[]` — payment/refund events with safe admin messages
- `internalNotes[]` — admin-only; never in customer APIs
- `failureMessage` — safe admin display string (no raw gateway payloads)
- `instrumentMasked` — masked card/wallet info when permitted
- `capabilities.supportsManualPayment`, `supportsRefundPreview`, `supportsPartialRefund`

### Permissions (UI gates)

| Permission | Behavior |
|------------|----------|
| `admin.payments.view` | List and detail |
| `admin.payments.revenue.view` | Revenue summary module |
| `admin.payments.refund` | Refund flow |
| `admin.payments.manual.record` | Manual payment dialog |
| `admin.payments.receipt` | Receipt download |
| `admin.payments.financial.view` | Private financial fields |

Hidden actions are not a security boundary.

### Refund semantics

1. `POST .../refund-preview` returns `maxRefundableLabel`, `allowsPartial`, `requiresReason`
2. UI shows destructive confirmation with exact Backend amount
3. `POST .../refund` with idempotency; pending gateway refunds show pending state
4. `409` on stale payment → refetch detail, no success toast

### Manual payment semantics

- Options and amount constraints from `manual-options` GET only
- No optimistic success; refetch payment/appointment/customer caches after confirm
- `409` on concurrent payment → refetch appointment balance

### Cache invalidation (frontend)

| Mutation | Invalidates |
|----------|-------------|
| Refund / manual payment | Admin payment list/detail, revenue summary, appointment detail/list, customer payments, dashboard |
| Receipt fetch | None (read-only) |

### Backend Dependency / API Contract (open)

- Mount global `GET /admin/payments` and detail endpoints above
- Document refund preview/submit body fields and partial refund rules
- Document manual payment methods and amount validation server-side
- Return `filterOptions.branches` only when multi-branch
- Revenue summary endpoint or explicit `404` to hide module
- Admin receipt endpoint or reuse signed URL in detail
- Never expose raw gateway payloads, secrets, or full card numbers
- Clarify relationship between customer `GET /customer/payments` and admin list shapes

## Phase 36 — Admin Coupons and Discounts

Operational coupon management for **one business** — not marketplace campaigns,
affiliate systems, cross-business promotions, or SaaS subscription discounts.
Discount amounts, eligibility, final booking totals, and usage counts remain
**Backend-authoritative**. The browser never calculates discount results,
rounded percentages, deposit after discount, or revenue impact.

### Routes (mounted)

- `/admin/coupons` — list (server-side search/filter/sort/pagination)
- `/admin/coupons/new` — create
- `/admin/coupons/{couponReference}` — detail with lifecycle actions
- `/admin/coupons/{couponReference}/edit` — edit with impact preview when supported

Customer booking payment step reuses existing quote integration (`POST /public/booking/quote`
with optional `couponCode`). Coupon UI is hidden when capability `coupons` or business
`couponsEnabled` is false.

### Feature gating

| Layer | Behavior |
|-------|----------|
| `ADMIN_COUPON_MANAGEMENT_ENABLED` | Module flag in `src/types/admin-coupon.ts` |
| Capability `coupons` | From `getBusinessCapabilities()` / public business payload |
| `couponsEnabled` on `PublicBusiness` | When explicitly `false`, hide admin nav and customer coupon field |
| Permissions | `admin.coupons.view`, `.create`, `.edit`, `.lifecycle` |

Direct route access when disabled shows existing feature-disabled empty state via
`AdminCouponsGate`. Booking/payment flows remain functional without coupons.

### Expected Backend endpoints

- `GET {API}/admin/coupons?q=&status=&discountType=&validity=&serviceId=&branchId=&sort=&direction=&page=&limit=`
- `POST {API}/admin/coupons` (+ `Idempotency-Key`) — create
- `GET {API}/admin/coupons/{reference}` — detail with stats, restrictions, allowedActions
- `PATCH {API}/admin/coupons/{reference}` (+ `Idempotency-Key`, optional `version`) — update
- `POST {API}/admin/coupons/{reference}/impact-preview` — body `{ action: pause|activate|archive|edit }`
- `POST {API}/admin/coupons/{reference}/pause|activate|archive` (+ `Idempotency-Key`, optional `version`)

Customer eligibility (existing Phase 13):

- `POST {API}/public/booking/quote` — optional `couponCode` in body; returns
  `discountLabel`, `finalAmountLabel`, `payableNowLabel`, `coupon: { code, status, message }`
- `POST {API}/customer/payments/sessions` — revalidates `couponCode` at submission

### Response shape (illustrative — list item)

```json
{
  "reference": "CPN-1",
  "code": "SUMMER20",
  "title": "تابستان ۲۰٪",
  "discountType": "percentage",
  "discountValueLabel": "۲۰٪",
  "status": "active",
  "startsAt": "2026-06-01T00:00:00+03:30",
  "endsAt": "2026-09-01T23:59:59+03:30",
  "timezoneLabel": "Asia/Tehran",
  "serverStatusLabel": "فعال",
  "stats": { "confirmedUsage": 12, "totalUsageLimit": 100, "remainingUsage": 88 },
  "allowedActions": { "edit": true, "pause": true }
}
```

### Lifecycle and status semantics

Frontend displays `status` / `lifecycle` and optional `serverStatusLabel` /
`serverTimeLabel` from Backend only. Do **not** infer authoritative lifecycle
from the browser clock. Supported values (when provided): `draft`, `scheduled`,
`active`, `paused`, `expired`, `exhausted`, `archived`.

### Code uniqueness and normalization

- Uniqueness, case sensitivity, trimming, allowed characters, and whether a
  used code may change are Backend rules.
- Frontend sends trimmed user input; displays normalized values from responses.
- `409` with duplicate/exists codes → field-level error on `code`.
- `409` with version/CONFLICT codes → concurrent update message; refetch detail.

### Usage counting semantics (Backend must define)

Document when a coupon is **consumed**: at quote preview, booking creation,
payment initiation, or final confirmation. Frontend displays `confirmedUsage`,
`remainingUsage`, `uniqueCustomers`, and `totalDiscountedLabel` from detail/stats
only — never aggregates from paginated list rows.

### Impact preview

Required before pause/activate/archive (and sensitive edit when supported).
Preview should state whether existing bookings remain unchanged. Blocked previews
(`blocked: true`) prevent confirm. `409` on stale `version` → refetch, no optimistic
lifecycle change.

### Restrictions model

- `serviceScope`: `all` | `include` | `exclude` with `serviceIds` / labels
- Optional `branchIds` / labels when multi-branch
- Optional customer restrictions when `capabilities.supportsCustomerRestrictions`
- `minimumAmount`, `maximumDiscount` as Backend-formatted labels or accepted
  input strings on write — no client-side discount math

### Cache invalidation (frontend)

| Mutation | Invalidates |
|----------|-------------|
| Create / update / lifecycle | Admin coupon list, detail, stats; booking quote queries; customer payment queries |
| Customer quote with coupon | Quote query key only (fingerprint includes coupon + booking context) |

Availability caches are **not** invalidated on coupon changes unless API contract
explicitly couples pricing to slot availability.

### Backend Dependency / API Contract (open)

- Mount all admin coupon endpoints above
- Document exact filter enum values and pagination contract
- Document impact preview actions and edit-sensitivity rules
- Document usage history pagination when `supportsUsageHistory`
- Clarify coupon consumption point (quote vs booking vs payment)
- Return `filterOptions.services` / `filterOptions.branches` on list when supported
- Expose `couponsEnabled` on `GET /public/business` (or equivalent capability payload)
- Document final submission revalidation errors: invalid, not started, expired, paused,
  exhausted, per-customer limit, ineligible service/branch, minimum not met, concurrent final-use conflict
- Never treat successful preview quote as guaranteed final eligibility

## Phase 37 — Admin Waiting List Management

Operational waiting-list management for **one business** — not a marketplace queue.
A waiting-list entry is **not** a booking. An accepted offer is **not always** a confirmed
appointment. Slot offers, holds, payments, and confirmed bookings remain **Backend-authoritative**.

Customer Phase 21 (`/waiting-list`, join, offer accept) shares the same status enums
(`WaitingListEntryStatus`, `WaitingListOfferStatus`) and adapters — admin must not introduce
a parallel incompatible status model.

### Routes (mounted)

- `/admin/waiting-list` — list (server-side search/filter/sort/pagination, URL-synced)
- `/admin/waiting-list/new` — manual entry (does not create appointments)
- `/admin/waiting-list/{entryReference}` — detail, lifecycle, notifications, offer history
- `/admin/waiting-list/{entryReference}/offer` — scoped availability → preview → send offer

### Feature gating

| Layer | Behavior |
|-------|----------|
| `ADMIN_WAITING_LIST_MANAGEMENT_ENABLED` | Module flag in `src/types/admin-waiting-list.ts` |
| Capability `waitingList` | From `getBusinessCapabilities()` / public business payload |
| Permissions | `admin.waiting_list.view`, `.create`, `.view_contact`, `.offer`, `.lifecycle`, `.notifications` |
| `allowedActions` on entries | Backend-driven action visibility (send offer, cancel, remove, retry notification, etc.) |

Direct route access when disabled shows feature-disabled empty state via `AdminWaitingListGate`.

### Expected Backend endpoints

- `GET {API}/admin/waiting-list?q=&entryStatus=&offerStatus=&serviceId=&providerId=&branchId=&preferredFrom=&preferredTo=&createdFrom=&createdTo=&sort=&direction=&page=&limit=`
- `POST {API}/admin/waiting-list` (+ `Idempotency-Key`) — manual entry
- `GET {API}/admin/waiting-list/duplicate-check?customerReference=&serviceId=&branchId=`
- `GET {API}/admin/waiting-list/{reference}` — detail with `allowedActions`, offer history, notification state
- `POST {API}/admin/waiting-list/{reference}/impact-preview` — body `{ action: remove|cancel|close }`
- `POST {API}/admin/waiting-list/{reference}/remove|cancel|close` (+ `Idempotency-Key`, optional `version`, `previewVersion`, `reason`)
- `GET {API}/admin/waiting-list/{reference}/offer-eligibility`
- `GET {API}/admin/waiting-list/{reference}/availability/dates` — **waiting-list-scoped** dates only
- `GET {API}/admin/waiting-list/{reference}/availability/slots?date=` — scoped slots; no internal resources in customer-facing fields
- `POST {API}/admin/waiting-list/{reference}/offer-preview` — body `{ slotId, expirationOptionId? }`; returns price/deposit/policy/expiration options from Backend
- `POST {API}/admin/waiting-list/{reference}/offers` (+ `Idempotency-Key`, `slotId`, `expirationOptionId`, `previewVersion`, `version`)
- `POST {API}/admin/waiting-list/{reference}/notifications/retry` (+ `Idempotency-Key`) when supported

Customer endpoints (Phase 21) remain separate; admin must **not** reuse unrestricted public
booking availability when waiting-list-scoped endpoints are absent.

### Status boundaries

**Entry status** and **offer status** are displayed separately in list and detail.
Frontend renders Backend-defined conversion outcomes after customer acceptance or admin refresh:
confirmed booking link, payment required route, active slot hold, admin confirmation required,
offer expired/rejected, slot conflict, entry remains waiting.

Do not construct gateway URLs, booking references, amounts, or financial results in the client.
Do not infer notification delivery from a successful offer-creation response.

### Offer countdown

Uses `expiresAt`, `serverNow` (or list/detail `offerServerNow`), and Backend offer status.
`OfferCountdown` refetches authoritative status on expiry; does not assume slot release until
Backend confirms. No excessive live-region announcements per tick.

### Concurrent updates

`409` / version conflict → stop action, show message, refetch entry/offer/availability, clear
invalid selections, require admin review. No auto-resubmit. Idempotency-Key on create, lifecycle,
offer send, notification retry.

### Cache invalidation (frontend)

| Mutation | Invalidates |
|----------|-------------|
| Manual entry / lifecycle | Admin waiting-list list + detail; customer waiting-list queries when entry affects customer |
| Send offer | Above + scoped availability for service/branch/date; dashboard counts |
| Confirmed conversion | Appointment list/detail; slot hold / payment when applicable |
| Notification retry | Detail + notification state only |

Does **not** clear entire query cache.

### Backend Dependency / API Contract (open)

- Mount all admin waiting-list endpoints above
- Document filter enum values, pagination, and server-side sort fields
- Document `allowedActions` matrix per entry status
- Document impact preview for remove vs cancel vs close (distinct semantics)
- Document duplicate detection rules and eligibility validation for manual entry
- Provide waiting-list-scoped availability (not generic public slots)
- Return `expirationOptions` only from Backend; support preview without `expirationOptionId` to fetch options
- Return `serverNow` on pending offers for countdown skew correction
- Document offer history pagination if list grows
- Document conversion outcome payloads after customer acceptance
- Document notification delivery states and when `retryNotification` is allowed
- Clarify version/etag concurrency fields on detail and offer send

## Phase 38 — Admin Notification Templates and Delivery Logs

Operational template management and delivery-log inspection for **one business**.
Separate from:

- **Phase 20** customer in-app inbox (`/notifications`) — read-only delivery results for customers
- **Channel infrastructure / provider credentials** — out of scope for Phase 38; high-level channel prefs are Phase 41 Business Settings (not secret keys)
- **Phase 37** per-entity waiting-list notification retry — not a global delivery-log module

Frontend does **not** implement providers, queues, webhooks, or template rendering engines.

### Routes (mounted)

- `/admin/notifications` — redirects to templates hub
- `/admin/notifications/templates` — template list (server-side filters/pagination)
- `/admin/notifications/templates/{templateReference}` — edit, variables, preview, enable/disable
- `/admin/notifications/logs` — delivery log list
- `/admin/notifications/logs/{logReference}` — log detail, timeline, optional retry

### Feature gating

| Layer | Behavior |
|-------|----------|
| `ADMIN_NOTIFICATION_MANAGEMENT_ENABLED` | Module flag in `src/types/admin-notification.ts` |
| Permissions | See table below |
| `allowedActions` on templates/logs | Backend-driven edit, preview, toggle, retry |

### Permissions (expected)

| Code | Capability |
|------|------------|
| `admin.notifications.view` | Nav + hub access |
| `admin.notifications.templates.view` | Template list/detail read |
| `admin.notifications.templates.edit` | Save template content |
| `admin.notifications.templates.toggle` | Enable/disable with impact preview |
| `admin.notifications.logs.view` | Delivery log list/detail |
| `admin.notifications.logs.retry` | Retry failed delivery when `allowedActions.retry` |
| `admin.notifications.logs.view_sensitive` | Unmasked recipient (optional; default is masked) |

### Expected Backend endpoints

**Templates**

- `GET {API}/admin/notifications/templates?eventType=&channel=&language=&status=&branchId=&q=&sort=&direction=&page=&limit=`
- `GET {API}/admin/notifications/templates/{reference}` — content, variables, language versions, `allowedActions`, `version`
- `PATCH {API}/admin/notifications/templates/{reference}` (+ `Idempotency-Key`, optional `version`) — save content for one language/channel
- `POST {API}/admin/notifications/templates/{reference}/preview` — safe render with sample values; returns warnings + `invalidVariables`
- `POST {API}/admin/notifications/templates/{reference}/impact-preview` — body `{ action: enable|disable }`
- `POST {API}/admin/notifications/templates/{reference}/enable|disable` (+ `Idempotency-Key`, optional `version`, `previewVersion`)

**Delivery logs**

- `GET {API}/admin/notifications/logs?from=&to=&eventType=&channel=&status=&templateReference=&branchId=&q=&sort=&direction=&page=&limit=`
- `GET {API}/admin/notifications/logs/{reference}` — masked recipient, timeline, related entities, `allowedActions`
- `POST {API}/admin/notifications/logs/{reference}/retry` (+ `Idempotency-Key`) — only when explicitly supported

### Template model

Dimensions (when provided): `eventType`, `channel` (`sms`|`email`), `language`, branch scope, `enabled`, `required`, `system`, `version`, `updatedAtLabel`.

**SMS fields:** `smsBody` only — no HTML.

**Email fields:** `emailSubject`, optional `emailPreviewText`, `emailBody`, optional `emailPlainText`, optional `direction`.

Variables catalog per template: `{ token, label, description?, sampleValue?, required? }`. Frontend blocks save when tokens not in catalog.

### Delivery status semantics

Frontend maps Backend status separately — **`sent` ≠ `delivered`**. Supported values:
`queued`, `processing`, `sent`, `delivered`, `failed`, `bounced`, `rejected`, `cancelled`, `unknown`.
Unknown values render as neutral fallback — never mapped to `delivered`.

Logs expose **masked** recipients only (`maskedRecipient`). No credentials, auth headers, provider secrets, or raw webhook payloads.

### Preview security

- Prefer Backend preview endpoint with sample values
- HTML email preview uses sandboxed iframe (`sandbox=""`) with `asSafeText` stripping scripts/tags before display
- No raw HTML injection into main DOM
- Preview does not guarantee delivery success

### Cache invalidation (frontend)

| Mutation | Invalidates |
|----------|-------------|
| Save template / enable / disable | Template list, detail, variables, preview queries for that reference |
| Log retry | Log list, log detail for that reference |
| Template content change | Does **not** invalidate appointments, availability, or payments |

### Backend Dependency / API Contract (open)

- Mount all endpoints above
- Document event-type enum (booking_confirmation, reminder, cancellation, reschedule, payment, refund, etc.)
- Document required/system templates that cannot be disabled
- Document multilingual template references / `languageVersions` when supported
- Return `filterOptions.languages`, `filterOptions.branches`, `filterOptions.templates` on list endpoints
- Document SMS segment/character counts from Backend when authoritative (client estimate is fallback only)
- Document preview HTML sanitization contract if Backend returns `emailBodyHtml`
- Document retry eligibility rules and duplicate-send warnings
- Clarify separation from Phase 20 customer inbox and Phase 41 business notification preferences (not provider credentials)
- Return `409` + version on concurrent template edits

## Phase 39 — Admin Reports UI

Historical analysis for **one business**. Separate from:

- **Phase 24** Admin Dashboard — current operational summary and quick actions
- Marketplace / multi-tenant BI / provider payout / SaaS subscription reporting — out of scope

Frontend does **not** calculate production metrics from raw appointment/payment lists.
Backend is authoritative for every metric, denominator, comparison, timezone bucket, and financial value.

### Routes (mounted)

- `/admin/reports` — Reports hub with URL-driven report type + filters
  - `?report=revenue|bookings|customers|services|staff|resources|branches|peak`
  - Date preset / custom range, comparison, branch, service, staff, resource, status filters

### Feature gating

| Layer | Behavior |
|-------|----------|
| `ADMIN_REPORTS_ENABLED` | Module flag in `src/types/admin-report.ts` |
| Permissions | Domain-granular (see table) |
| Branch report | Hidden/gated when multi-branch capability is disabled |
| `allowedActions.export` | Backend-driven export eligibility |

### Permissions (expected)

| Code | Capability |
|------|------------|
| `admin.reports.view` | Nav + hub access |
| `admin.reports.revenue.view` | Revenue report |
| `admin.reports.bookings.view` | Booking / cancellation / no-show report |
| `admin.reports.customers.view` | Customer growth |
| `admin.reports.services.view` | Service performance |
| `admin.reports.staff.view` | Staff operational metrics (not public rankings) |
| `admin.reports.resources.view` | Resource utilization |
| `admin.reports.branches.view` | Branch performance (same business locations) |
| `admin.reports.peak.view` | Peak hours / days |
| `admin.reports.export` | Create/download export for current filters |

### Expected Backend endpoints

- `GET {API}/admin/reports/meta` — supported reports, presets, comparison modes, max range days, timezone, filter options, `branchesEnabled`
- `GET {API}/admin/reports/{reportType}?preset=&from=&to=&comparison=&compareFrom=&compareTo=&branchId=&serviceId=&staffId=&resourceId=&resourceType=&appointmentStatus=&paymentStatus=`
- `POST {API}/admin/reports/export` (+ `Idempotency-Key`) — body mirrors current validated filters; returns export job
- `GET {API}/admin/reports/export/{jobId}` — status (`pending`|`processing`|`ready`|`failed`|`expired`) + time-limited `downloadUrl`

### Report response model (view)

- `range` / optional `comparisonRange` with labels and timezone
- `lastUpdatedAt` / snapshot timestamp
- `metrics[]` — each with `key`, `label`, `state` (`ready`|`unavailable`|`error`), `valueLabel` (preferred for money), optional Backend `comparison` (`absoluteChangeLabel`, `percentageChangeLabel` only when defined, `tone`, `periodLabel`), optional `definition`
- `series[]` — chart points with labels + optional `barPercent` (Backend-provided)
- `breakdown[]` — rows with masked identities when required
- `peakHours` / `peakDays` / `heatmap` for peak report
- `empty` / `emptyReason` / `rangeInvalid` / `rangeInvalidMessage`
- `filterOptions`, `allowedActions`

**Never** replace `unavailable` with `0`. Frontend does not invent percentages when baseline is zero.

### Financial semantics

Display only Backend-calculated gross/net revenue, refunds, deposits, collected/outstanding.
Do not aggregate multiple currencies without Backend conversion.

### Charts / accessibility

Frontend uses Design-Token CSS bar charts + mandatory accessible tables (no chart library dependency).
Heatmap includes keyboard-focusable cells and a textual table alternative.
`prefers-reduced-motion` disables bar width transitions.

### Export / privacy

- Export uses current URL-validated filters only
- Download via Backend-authorized time-limited URL (`window.open` / new tab)
- No auth tokens in frontend route query strings
- Sensitive report query caches cleared on logout via `clearFrontendCaches` (full QueryClient clear)
- Customer/staff breakdowns must arrive pre-masked from Backend when required

### Cache

| Key | Behavior |
|-----|----------|
| `queryKeys.admin.reportMeta` | Meta/presets |
| `queryKeys.admin.report` | Active report + all filter dimensions |
| `queryKeys.admin.reportExport` | Export job polling while pending/processing |

Only the active report type is fetched. No appointment/payment list invalidation on report reads.

### Backend Dependency / API Contract (open)

- Mount meta + per-domain report endpoints above
- Document metric keys and denominators (cancellation rate, no-show rate)
- Document approved date presets, max range, business timezone
- Document comparison period definitions and when `percentageChangeLabel` is omitted
- Document branch capability interaction with `branches` report
- Document export formats, retention, and download URL auth model
- Clarify Dashboard vs Reports metric ownership (operational today vs historical)
- Return `409`/`422` for oversized or invalid ranges with machine-readable codes

## Phase 40 — Admin Users, Roles, and Permission Matrix

Access management for the **admin panel of one business**.

Entity boundaries (must stay distinct):

- **Admin User** — authenticated admin-panel account
- **Role** — named collection of permissions
- **Permission** — authorization capability from Backend catalog
- **Staff** — business employee/provider (linking ≠ Admin User)
- **Customer** — customer account

No public Staff/Provider registration, tenant management, or cross-business user admin.

### Permission Catalog audit (frontend)

Consumed keys are inventoried in `src/lib/admin/permission-catalog-audit.ts` (`FRONTEND_CONSUMED_PERMISSION_KEYS`).
Phase 40 module keys expected from Backend (`PHASE40_EXPECTED_PERMISSION_KEYS`):

- `admin.users.view|create|edit|deactivate|assign_role|link_staff`
- `admin.roles.view|create|edit|delete|assign_permissions`

`auditPermissionCatalogCoverage(backendKeys)` reports frontend-only / backend-only gaps.
**Do not silently rename** existing frontend permission keys.

### Routes (mounted)

- `/admin/users` — list (search/filter/pagination URL state)
- `/admin/users/new` — invite/create
- `/admin/users/{userReference}` — detail + activate/deactivate with impact preview
- `/admin/users/{userReference}/edit` — role, branch scope, staff link
- `/admin/roles` — role list
- `/admin/roles/new` — custom role + Permission Matrix
- `/admin/roles/{roleReference}` — detail
- `/admin/roles/{roleReference}/edit` — edit matrix

### Expected Backend endpoints

- `GET {API}/admin/users?...`
- `GET|PATCH {API}/admin/users/{reference}`
- `POST {API}/admin/users` (+ `Idempotency-Key`) — invite/create
- `POST {API}/admin/users/{reference}/impact-preview`
- `POST {API}/admin/users/{reference}/activate|deactivate` (+ `Idempotency-Key`)
- `GET {API}/admin/roles?...`
- `GET|PATCH|DELETE {API}/admin/roles/{reference}`
- `POST {API}/admin/roles` (+ `Idempotency-Key`)
- `POST {API}/admin/roles/impact-preview` and `.../{reference}/impact-preview`
- `GET {API}/admin/permissions/catalog` — authoritative Permission Catalog

### Matrix rules

- Built **only** from Backend catalog items (`key`, `label`, `description`, `domain`, `dependsOn`, `required`, `locked`, `riskLevel`)
- Group Select All + indeterminate via existing `Checkbox`
- Auto-grant only Backend `required`/`locked` dependencies — no label-pattern inference
- Permission ≠ Branch scope (independent)

### Protections

- System roles: no unsupported edit/delete controls (`system`, `editable`, `deletable`, `allowedActions`)
- Last-admin / self-action: respect Backend `allowedActions` + impact preview `blocked`
- Mutations non-optimistic; `409` version conflict handling
- After mutation affecting current user: invalidate session, clear admin query caches, refresh navigation

### Privacy

- Masked email/phone only
- No passwords, invitation tokens, or secrets in URLs/logs
- Deactivating Admin User does not deactivate linked Staff

### Backend Dependency / API Contract (open)

- Mount endpoints above and return Permission Catalog aligned with frontend-consumed keys
- Document invitation channel (phone/email), pending states, duplicate rules
- Document Staff link/unlink impact (must not change bookability/visibility unless explicit)
- Document last-admin / last user-management holder rules
- Document Branch scope model for multi-branch businesses
- Document which system roles exist and which are editable
- Return `allowedActions` for every User/Role mutation surface
- Clarify Activity Logs fields for Phase 42 (reason/version/idempotency only — no fabricated logs)

## Calendar / Jalali



The Design System calendar is Gregorian (`Date` + ISO `YYYY-MM-DD`). Jalali is
**not** simulated by translating month names. A Jalali adapter is deferred to
the localization phase (Phase 48) via `src/lib/date-time/calendar-adapter.ts`.
This is a frontend concern, not a Backend API.

## CORS and cookies

The API origin must allow the frontend origin with credentialed cookies.
`SameSite=None; Secure` is required if the UI and API are on different sites.

## Out of scope for the frontend

Token generation, JWT validation, permission enforcement, and data storage
remain Backend responsibilities. Hidden UI is not a security boundary.

## Phase 41 � Business Settings

Operational settings for **one dedicated business** (clinic / radiology / salon).
No tenant creation, tenant switching, SaaS billing, marketplace settings, or public business onboarding.

Separate from:

- **Phase 38** notification template editing (/admin/notifications/templates)
- **Phase 18** customer profile settings (/profile)
- **Public** read-only `PublicBusiness` branding (invalidated after identity/logo changes)

### Permissions (UI contract � Backend catalog must align)

Hub: `admin.settings.view`

Per section (independent):

- `admin.settings.general.view|edit`
- `admin.settings.localization.view|edit`
- `admin.settings.booking.view|edit`
- `admin.settings.payments.view|edit`
- `admin.settings.notifications.view|edit`

Keys are listed in `PHASE41_EXPECTED_PERMISSION_KEYS` / `permission-catalog-audit.ts`.
Frontend gating does not replace Backend authorization.

### Routes (mounted)

- `/admin/settings` � redirects to general
- `/admin/settings/general` � identity, contact, logo
- `/admin/settings/localization` � language, currency, timezone, locale, calendar, number format
- `/admin/settings/booking` � advance windows, slot interval/hold, confirmation, provider options, policies
- `/admin/settings/payments` � safe payment preferences + gateway connection **status** only
- `/admin/settings/notifications` � high-level channel/event prefs (not templates)

Each section has independent loading, validation, dirty state, and save feedback.

### Expected Backend endpoints

- `GET|PATCH {API}/admin/settings/general` (+ `version` / ETag)
- `POST {API}/admin/settings/general/logo` (`multipart/form-data` field `logo`, `Idempotency-Key`)
- `DELETE {API}/admin/settings/general/logo` (`Idempotency-Key`)
- `GET|PATCH {API}/admin/settings/localization`
- `POST {API}/admin/settings/localization/impact-preview`
- `GET|PATCH {API}/admin/settings/booking`
- `POST {API}/admin/settings/booking/impact-preview`
- `GET|PATCH {API}/admin/settings/payments`
- `GET|PATCH {API}/admin/settings/notifications`

Responses should include `allowedActions`, `capabilities`, `unsupportedFields`, and select `*Options` where applicable.

### Domain rules (frontend must NOT)

- Invent production settings fields or endpoints
- Calculate availability, slots, cancellation eligibility, refunds, or FX conversion
- Rewrite historical timestamps when timezone changes
- Convert historical prices when currency changes
- Display/collect/log gateway secrets, private tokens, or card data
- Duplicate Phase 38 template editors
- Clear the entire React Query cache on save

### Cache invalidation (frontend)

| Section | Invalidates |
| --- | --- |
| general / logo | `admin.settings` general + `publicBusiness` |
| localization | public business/services, booking, admin calendar/appointments/reports/waiting-list, customer appointments/payments |
| booking | booking queries, publicBusiness, admin availability |
| payments | booking quotes, customer/admin payments, publicBusiness |
| notifications | admin notifications |

### Backend Dependency / API Contract (open)

- Mount section endpoints and document field units (minute/hour/day)
- Return option lists for language/currency/IANA timezone/locale/calendar/number format
- Document impact-preview payloads for booking + currency/timezone
- Document logo upload constraints and final URL shape (no Base64 unless required)
- Document validation error format and version/concurrency (409)
- Document public cache effects after identity/logo changes
- Confirm payment gateway status enum only (Connected / Not Connected / Disabled / Requires Action)
- Clarify which settings are unsupported vs feature-disabled

## Phase 42 � Admin Activity Logs

Immutable administrative audit records for **one business**.
Not browser console logs, infrastructure monitoring, error tracking, or editable entities.

Frontend **never fabricates** production audit events.

### Permissions (UI contract)

- `admin.activity_logs.view` � list
- `admin.activity_logs.view_detail` � detail
- `admin.activity_logs.view_changes` � before/after values
- `admin.activity_logs.view_private` � private/sensitive fields (unmask)
- `admin.activity_logs.view_security` � security-related event details
- `admin.activity_logs.export` � export when supported

Listed in `PHASE42_EXPECTED_PERMISSION_KEYS` / `permission-catalog-audit.ts`.

### Routes (mounted)

- `/admin/activity-logs` � server-driven list (URL filters/pagination)
- `/admin/activity-logs/{logReference}` � read-only detail (deep-linkable)

### Expected Backend endpoints

- `GET {API}/admin/activity-logs?...` � `q`, `actor`, `action`, `entityType`, `result`, `branchId`, `from`, `to`, `sort`, `direction`, `page`, `limit`
- `GET {API}/admin/activity-logs/{reference}`
- Optional export: `POST {API}/admin/activity-logs/export` + `GET .../export/{jobId}` (secure Backend file URL)

List/detail should include `filterOptions`, `capabilities`, `allowedActions`, sanitized `changes` / previous+new values, and entity availability flags.

### Domain rules (frontend must NOT)

- Fabricate audit rows
- Edit/delete logs
- Infer authoritative meaning from free text alone
- Show passwords, OTP, tokens, cookies, secrets, card data, raw sensitive headers
- Client-build large exports
- Treat missing entity access as a missing log

### Action / entity mapping

Known structured codes (e.g. `appointment.cancelled`, `settings.booking_updated`) map to localized labels; unknown codes show a safe fallback and keep the original code in detail.

### Backend Dependency / API Contract (open)

- Mount list/detail endpoints with pagination/sorting/filters
- Publish structured action code catalog
- Document actor/entity models and deleted-entity semantics (`entityAvailable` / unavailable reason)
- Provide sanitized before/after schema (field-level preferred)
- Document retention behavior
- Document timestamp/timezone semantics (Backend authoritative)
- Confirm export job contract or mark unsupported (`supportsExport: false`)
- Clarify permission scopes for private/security fields

## Phase 43 � Responsive Design Audit (Frontend-only)

No new Backend API contracts. Frontend remediates layout across public, auth, customer, and admin surfaces.

### Canonical breakpoints

| Token | CSS / rem | Role |
| --- | --- | --- |
| sm | 480px / 30rem | Compact form grids |
| md | 768px / 48rem | Customer/public chrome; booking wizard sticky?static |
| lg | 1024px / 64rem | Admin sidebar; admin table?card dual layouts |
| xl | 1280px / 80rem | Wide content |

JS helpers: `src/lib/responsive/breakpoints.ts` (`MEDIA_MAX_MD` = 767px, `MEDIA_MAX_LG` = 1023px).

### Frontend behavior (no Backend change)

- Root `viewportFit: cover` for safe-area sticky CTAs
- Booking sticky nav / payment actions respect `env(safe-area-inset-*)`
- Admin drawer: focus trap, Escape/overlay close, body+html scroll lock, close on navigate
- Admin dual layouts at `64rem` (appointments, services, recent dashboard)
- Image `sizes` aligned to 768 / 1024
- Content width capped with `--content-max` on ultra-wide desktops

### Backend Dependency / API Contract (open)

None for Phase 43. Responsive behavior is presentation-only.

## Phase 44 � Global UX States (Frontend-only)

No new Backend endpoints. Frontend standardizes authentication, permission, capability, loading, empty vs no-results, error classification, conflict, confirmation, and session-expiry UX using existing design-system feedback components.

### Frontend contracts reused

- Normalized errors via `toAppApiError` / `classifyApiError` (`src/lib/api/error-ui.ts`)
- Query retry remains safe for reads; mutations `retry: 0`; financial/booking paths never auto-retried
- Session expiry: clear booking draft/hold/challenge + React Query cache, single redirect to `/session-expired` with safe internal `redirect`
- 403 remains in-app (`PermissionDeniedState`) � does not log the user out
- Missing API / `MISSING_API_BASE_URL` surfaces as `BackendDependencyState`, not empty data

### Backend Dependency / API Contract (open)

None required for Phase 44 presentation. Continue documenting structured error `code` values (SESSION_EXPIRED, FEATURE_DISABLED, conflict/slot codes) so classification stays accurate.
