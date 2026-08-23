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
    "permissionCodes": ["opaque.code.from.backend"],
    "adminPanelAccess": "granted"
  }
}
```

`adminPanelAccess` must be one of `granted`, `denied`, or omitted (`unknown`).
Do not send invented role names; permission codes stay opaque until this
contract is finalized.

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
