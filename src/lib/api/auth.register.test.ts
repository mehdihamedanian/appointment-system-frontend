import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";
import { registerCustomer } from "@/lib/api/auth";

const mockedClient = vi.mocked(apiClient);

const input = {
  firstName: "مریم",
  lastName: "احمدی",
  phone: "09121234567",
  password: "Secret-Pass-1",
  consent: true,
};

const backendUser = {
  id: "usr_1",
  first_name: "مریم",
  last_name: "احمدی",
  mobile: "+989121234567",
  roles: ["customer"],
};

describe("registerCustomer against the Backend contract", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("registers with an E.164 mobile and then signs in, because register issues no session", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/auth/register") return { user: backendUser };
      if (path === "/auth/login") return { user: backendUser };
      throw new Error(`unexpected ${path}`);
    });

    const result = await registerCustomer(input);

    expect(mockedClient).toHaveBeenNthCalledWith(
      1,
      "/auth/register",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({ phone: "+989121234567" }),
      }),
    );
    expect(mockedClient).toHaveBeenNthCalledWith(
      2,
      "/auth/login",
      expect.objectContaining({
        body: { identifier: "+989121234567", password: input.password },
      }),
    );
    expect(result.user?.id).toBe("usr_1");
    expect(result.challenge).toBeNull();
    expect(result.signInRequired).toBe(false);
  });

  it("asks the user to sign in when the automatic login is refused", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/auth/register") return { user: backendUser };
      throw new ApiError({ status: 401, message: "Invalid credentials." });
    });

    const result = await registerCustomer(input);

    expect(result.user).toBeNull();
    expect(result.signInRequired).toBe(true);
  });

  it("returns an OTP challenge without signing in when the Backend requires verification", async () => {
    mockedClient.mockResolvedValueOnce({
      challenge_id: "ch_1",
      expires_at: "2026-08-20T08:02:00Z",
    });

    const result = await registerCustomer(input);

    expect(result.challenge?.challengeId).toBe("ch_1");
    expect(result.user).toBeNull();
    expect(mockedClient).toHaveBeenCalledTimes(1);
  });

  it("surfaces registration errors such as a duplicate mobile", async () => {
    mockedClient.mockRejectedValueOnce(new ApiError({ status: 409, message: "exists" }));
    await expect(registerCustomer(input)).rejects.toMatchObject({ status: 409 });
    expect(mockedClient).toHaveBeenCalledTimes(1);
  });
});
