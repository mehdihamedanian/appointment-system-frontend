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

## Phase 1 notes

- Public, authentication, customer, and admin route groups are shells.
- Customer and admin URLs are cookie-gated in `src/proxy.ts`. Without a session
  cookie, those paths redirect to `/login`.
- Session restoration calls `GET {NEXT_PUBLIC_API_BASE_URL}/auth/session`.
- See `BACKEND_DEPENDENCIES.md` for the API contract still required from the
  Backend.

## Repository boundary

Do not add marketplace, tenant, subscription, provider onboarding, or
cross-business search concepts. This UI serves one business.
