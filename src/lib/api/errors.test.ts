import { describe, expect, it } from "vitest";
import { normalizeHttpError, normalizeNetworkError } from "@/lib/api/errors";
import { adaptSessionPayload } from "@/lib/api/session-adapter";

describe("API error normalization", () => {
  it("maps known HTTP statuses and field errors without assuming a single payload shape", () => {
    const error = normalizeHttpError(
      422,
      {
        message: "اعتبارسنجی ناموفق بود",
        code: "VALIDATION_FAILED",
        fieldErrors: { phone: ["شماره نامعتبر است"] },
        requestId: "req_1",
      },
      new Headers(),
    );

    expect(error).toMatchObject({
      status: 422,
      code: "VALIDATION_FAILED",
      message: "اعتبارسنجی ناموفق بود",
      fieldErrors: { phone: ["شماره نامعتبر است"] },
      requestId: "req_1",
    });
  });

  it("reads request ids from headers when the body omits them", () => {
    const error = normalizeHttpError(
      404,
      { title: "Not found" },
      new Headers({ "x-request-id": "corr-9" }),
    );

    expect(error.status).toBe(404);
    expect(error.requestId).toBe("corr-9");
    expect(error.message).toBe("Not found");
  });

  it("normalizes abort and timeout errors", () => {
    expect(normalizeNetworkError(new DOMException("Aborted", "AbortError"))).toMatchObject({
      code: "REQUEST_ABORTED",
      status: 0,
    });
    expect(
      normalizeNetworkError(new DOMException("Timed out", "TimeoutError")),
    ).toMatchObject({
      code: "REQUEST_TIMEOUT",
    });
  });
});

describe("session adapter", () => {
  it("maps an unknown payload into a typed session without inventing roles", () => {
    const session = adaptSessionPayload({
      user: {
        id: "u1",
        displayName: "نمونه",
        permissions: ["placeholder.a"],
        adminPanelAccess: "granted",
      },
    });

    expect(session.status).toBe("authenticated");
    expect(session.user).toMatchObject({
      id: "u1",
      permissionCodes: ["placeholder.a"],
      adminPanelAccess: "granted",
    });
  });

  it("treats a payload without a user id as unauthenticated", () => {
    expect(adaptSessionPayload({ ok: true })).toEqual({
      status: "unauthenticated",
      user: null,
    });
  });
});
