import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { fetchSession } from "@/lib/auth/session";
import { adaptOtpChallenge } from "@/lib/api/auth";

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("session restoration", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("maps an authenticated session payload", async () => {
    mockedClient.mockResolvedValueOnce({
      user: {
        id: "user_1",
        displayName: "آزمایش",
        adminPanelAccess: "denied",
      },
    });

    await expect(fetchSession()).resolves.toMatchObject({
      status: "authenticated",
      user: { id: "user_1" },
    });
  });

  it("maps expired sessions separately from anonymous ones", async () => {
    mockedClient.mockRejectedValueOnce(
      new ApiError({
        status: 401,
        code: "SESSION_EXPIRED",
        message: "منقضی",
      }),
    );

    await expect(fetchSession()).resolves.toMatchObject({ status: "expired" });
  });

  it("derives admin panel access from the Backend user summary", async () => {
    mockedClient.mockResolvedValueOnce({
      success: true,
      data: {
        user: {
          id: "user_owner",
          first_name: "Owner",
          last_name: "Admin",
          mobile: "+989121234567",
          account_type: "internal",
          roles: ["owner"],
        },
      },
    });
    await expect(fetchSession()).resolves.toMatchObject({
      status: "authenticated",
      user: {
        id: "user_owner",
        displayName: "Owner Admin",
        adminPanelAccess: "granted",
        permissionCodes: [],
      },
    });

    mockedClient.mockResolvedValueOnce({
      data: { user: { id: "user_customer", account_type: "customer", roles: ["customer"] } },
    });
    await expect(fetchSession()).resolves.toMatchObject({
      user: { adminPanelAccess: "denied" },
    });
  });

  it("does not trigger the global unauthorized handler for the session probe", async () => {
    mockedClient.mockResolvedValueOnce({ user: { id: "user_1" } });
    await fetchSession();
    expect(mockedClient).toHaveBeenCalledWith(
      "/auth/session",
      expect.objectContaining({ notifyUnauthorized: false }),
    );
  });
});

describe("otp challenge adapter", () => {
  it("reads expiration timestamps from the Backend payload", () => {
    const challenge = adaptOtpChallenge(
      {
        challengeId: "ch_1",
        maskedDestination: "0912***67",
        expiresAt: "2026-08-21T12:00:00.000Z",
        resendAvailableAt: "2026-08-21T11:59:00.000Z",
      },
      "login",
      "09121234567",
    );
    expect(challenge.challengeId).toBe("ch_1");
    expect(challenge.expiresAt).toContain("2026-08-21");
  });
});
