# Backend Dependency / API Contract

This frontend is a dedicated booking UI for a **single business**. It does not
implement authentication, authorization, or persistence. The items below are
required from `appointment-system-backend` before later phases can go beyond
shells and session plumbing.

## Public configuration

| Name | Where used | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | API client | Public base URL including `/api/v1` if that is the prefix |
| `SESSION_COOKIE_NAME` | `src/proxy.ts` | Name of the HttpOnly session cookie. Default: `session` |

No secrets belong in the frontend environment.

## Session

Preferred model: **HttpOnly, Secure, SameSite cookie** issued by the Backend.
The frontend never stores access tokens, refresh tokens, OTPs, or passwords in
`localStorage` or `sessionStorage`.

Expected session endpoint used by the frontend:

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

## Login, logout, refresh

Frontend Phase 1 does not call login forms yet, but later phases will need:

- `POST {API}/auth/login`
- `POST {API}/auth/logout` (already invoked on client logout)
- `POST {API}/auth/refresh` or cookie rotation on the session endpoint
- OTP verification and password reset endpoints when those screens are built

Logout must clear the session cookie. The frontend always clears React Query
cache locally, even if logout fails.

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
`5xx`.

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

## CORS and cookies

The API origin must allow the frontend origin with credentialed cookies.
`SameSite=None; Secure` is required if the UI and API are on different sites.

## Out of scope for the frontend

Token generation, JWT validation, permission enforcement, and data storage
remain Backend responsibilities. Hidden UI is not a security boundary.
