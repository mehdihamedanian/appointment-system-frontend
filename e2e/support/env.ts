function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for E2E (see e2e/README.md).`);
  }
  return value;
}

export const e2eEnv = {
  get backendUrl() {
    return required("E2E_BACKEND_URL").replace(/\/+$/, "");
  },
  get ownerMobile() {
    return required("E2E_OWNER_MOBILE");
  },
  get ownerPassword() {
    return required("E2E_OWNER_PASSWORD");
  },
  /** Bookable fixture service and branch created by the isolated stack setup (see e2e/README.md). */
  get serviceId() {
    return required("E2E_SERVICE_ID");
  },
  get branchId() {
    return required("E2E_BRANCH_ID");
  },
  get backendLog() {
    return process.env.E2E_BACKEND_LOG?.trim();
  },
};

/** Unique per run so repeated runs against the same throwaway database never collide. */
export const runId = Date.now().toString(36).slice(-6);
