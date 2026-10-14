import { test } from "@playwright/test";

/**
 * Checklist flows that cannot run end to end against the current Backend contract.
 * Each is reported as skipped with the concrete blocker; mocked coverage lives in Vitest
 * (see e2e/README.md for the mapping). Remove the `fixme` once the blocker is resolved.
 */

test.describe("blocked by the Backend contract", () => {
  test.fixme("customer: choose a branch in the booking wizard", () => {
    // Availability and POST /appointments/me require branch_id, but no route a customer may
    // read lists branches (GET /branches does not exist; /staff and /resources need staff.read
    // and resources.read), and there is no /public/business for branchesEnabled. Without a
    // branch in the link the wizard stops at the date step ("شعبه انتخاب نشده است").
    // booking.spec.ts covers the wizard entered from a branch-specific link.
  });

  test.fixme("customer: payment reaches a verified paid state", () => {
    // Paid is only reachable through the gateway's signed callback. The fake gateway
    // marks an intent paid in-process (mark_fake_payment_paid), not over HTTP; a sandbox
    // gateway is required. release.spec.ts covers intent creation, the allow-listed
    // redirect (intercepted) and the pending result.
  });

  test.fixme("admin: appointment status actions", () => {
    // AdminAppointmentDetail has no allowed-actions field, so the frontend cannot offer
    // confirm/check-in/complete/no-show without duplicating the Backend status machine.
  });
});
