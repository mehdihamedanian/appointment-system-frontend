import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync(join(process.cwd(), "src/config/env.ts"), "utf8");

describe("env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reads every variable literally so Next.js can inline public values into client bundles", () => {
    expect(source).not.toMatch(/process\.env\[/);
    const named = new Set(source.match(/NEXT_PUBLIC_[A-Z_]+/g));
    const literal = new Set(source.match(/(?<=process\.env\.)NEXT_PUBLIC_[A-Z_]+/g));
    expect([...named].filter((name) => !literal.has(name))).toEqual([]);
  });

  it("normalizes the payment gateway allowlist to origins", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_PAYMENT_GATEWAY_ORIGINS",
      "https://pay.example.com/start, javascript:alert(1), https://sandbox.example.com:8443",
    );
    const { env } = await import("@/config/env");
    expect(env.paymentGatewayOrigins).toEqual([
      "https://pay.example.com",
      "https://sandbox.example.com:8443",
    ]);
  });
});
