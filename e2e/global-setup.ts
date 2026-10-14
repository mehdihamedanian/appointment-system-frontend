import { e2eEnv } from "./support/env";

/**
 * Write tests create services, staff, resources, customers and appointments.
 * They must never reach development data, so the run has to opt in explicitly
 * and the Backend has to answer on the declared isolated URL.
 */
export default async function globalSetup() {
  if (process.env.E2E_ISOLATED_BACKEND !== "1") {
    throw new Error(
      "Refusing to run E2E: set E2E_ISOLATED_BACKEND=1 only when E2E_BACKEND_URL is a throwaway Backend " +
        "with its own database (see e2e/README.md).",
    );
  }
  const response = await fetch(`${e2eEnv.backendUrl}/health`).catch(() => undefined);
  if (!response?.ok) {
    throw new Error(`Isolated Backend is not healthy at ${e2eEnv.backendUrl}/health.`);
  }
}
