# Browser E2E (Playwright)

Real-browser tests that drive the frontend against a **throwaway** Backend. They
create services, customers and other records, so they must never point at the
development database, the development Redis, or an account you care about.
`e2e/global-setup.ts` refuses to run unless `E2E_ISOLATED_BACKEND=1` is set and
the Backend health check answers.

## Isolated stack

Use separate containers and ports (development Postgres/Redis stay on 5432/6379):

```powershell
docker run -d --rm --name appt_e2e_pg -p 127.0.0.1:55432:5432 --tmpfs /var/lib/postgresql/data `
  -e POSTGRES_USER=e2e -e POSTGRES_PASSWORD=<throwaway> -e POSTGRES_DB=appointment_e2e postgres:16-alpine
docker run -d --rm --name appt_e2e_redis -p 127.0.0.1:56379:6379 redis:7-alpine
```

Backend (a copy of the Backend `.env` in a scratch directory, never the Backend repo itself):

- `APP_ENV=development`, `DATABASE_URL` → `127.0.0.1:55432/appointment_e2e`, `REDIS_URL` → `127.0.0.1:56379`.
- `PAYMENT_GATEWAY_PROVIDER` fake/sandbox and `NOTIFICATION_*_PROVIDER=fake` — no real payments or messages.
- `CORS_ALLOWED_ORIGINS=http://localhost:3100`, OTP/login rate limits raised (≤ 100) for repeated runs.
- `BOOTSTRAP_OWNER_*` for a throwaway owner. Use an **E.164** mobile (`+989…`): the Backend
  normalises `09…` to `+9…`, which can then never sign in through the UI.

Then migrate, seed and start it on port 8100 from the Backend checkout with that env. On
Windows, 8100 can fall inside an excluded TCP port range (`netsh int ipv4 show excludedportrange
protocol=tcp`; bind fails with WinError 10013). Use another port such as 8300 and change
`NEXT_PUBLIC_API_BASE_URL`, `E2E_BACKEND_URL` and the Backend `PAYMENT_PUBLIC_BASE_URL` to match.
`NEXT_PUBLIC_API_BASE_URL` is inlined at build time, so rebuild after changing it.

```powershell
alembic upgrade head
python scripts/seed.py
python scripts/bootstrap_owner.py
python -m uvicorn app.main:app --host 127.0.0.1 --port 8100
```

Frontend on port 3100 pointed at it. Release verification uses a production build
(`next build` refuses to build without the variables checked by `src/config/production-env.ts`):

```powershell
$env:NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:8100/api/v1"
$env:NEXT_PUBLIC_SITE_URL = "http://localhost:3100"
$env:NEXT_PUBLIC_BUSINESS_TIMEZONE = "Asia/Tehran"
$env:NEXT_PUBLIC_CALENDAR_SYSTEM = "persian"
$env:NEXT_PUBLIC_PAYMENT_GATEWAY_ORIGINS = "https://fake-gateway.test"
npx next build
npx next start -p 3100
```

### Bookable fixture (`release.spec.ts`)

The Backend has no branch create/list API, so the bookable fixture is prepared once per
throwaway database:

1. Insert one active branch row directly into the throwaway database.
2. As the owner, create a fixed-price service (`POST /services`, or `admin.spec.ts`).
3. Create a staff member with the `staff` resource type for that branch, link it to the
   service (`POST /staff/{id}/services/{serviceId}`), give it working hours
   (`PUT /staff/{id}/working-hours`) and require one staff resource on the service
   (`PUT /services/{id}/resource-requirements`).

Pass the IDs through the environment — never hardcode them in `src/`:
`E2E_SERVICE_ID`, `E2E_BRANCH_ID`.

## Running

```powershell
$env:E2E_ISOLATED_BACKEND = "1"
$env:E2E_BACKEND_URL = "http://127.0.0.1:8100/api/v1"
$env:E2E_OWNER_MOBILE = "<throwaway owner mobile>"
$env:E2E_OWNER_PASSWORD = "<throwaway owner password>"
$env:E2E_SERVICE_ID = "<fixture service id>"
$env:E2E_BRANCH_ID = "<fixture branch id>"
npm run test:e2e
```

`release.spec.ts` intercepts `https://fake-gateway.test/**` with `page.route`, so the
payment check never leaves the machine and no transaction is made.

Optional: `E2E_BASE_URL` (default `http://localhost:3100`), `E2E_BROWSER_CHANNEL`
(default `chrome`; use `chromium` after `npx playwright install chromium`).
Failures keep a screenshot and trace under `test-results/e2e/`.

## Teardown

Stop uvicorn and `next start`/`next dev`, then `docker stop appt_e2e_pg appt_e2e_redis`
(the containers use `--rm` and Postgres data lives in tmpfs).

## Coverage

| Spec | Flow |
| --- | --- |
| `admin.spec.ts` | Admin login, manage service, manage staff, manage resource, calendar flow |
| `admin-resources.spec.ts` | Service resource mapping (pin a room, saved requirement read back from the Backend); block a resource for a day and release it |
| `admin-booking.spec.ts` | Manual appointment: customer search, branch from qualified staff, slot, submit, read back as the customer; with a chosen room among alternatives, read back from `reserved_resources` |
| `booking.spec.ts` | Customer booking wizard entered from a branch-specific link → confirmation; appointment read back from the Backend |
| `customer.spec.ts` | Register → signed in, login, my appointments, wrong password |
| `release.spec.ts` | Customer and owner session persistence (reload, new tab) and logout; booked appointments in list and detail; payment intent → allow-listed gateway redirect (intercepted) → pending result; cancel; reschedule; availability conflict with a second customer |
| `blocked.spec.ts` | `fixme` flows the current Backend contract cannot complete, each with its blocker |

Blocked flows keep mocked coverage in Vitest: in-wizard branch choice
(`src/features/booking`), paid payment results (`src/features/booking/payment-screen.test.tsx`)
and admin status actions (`src/features/admin`).
