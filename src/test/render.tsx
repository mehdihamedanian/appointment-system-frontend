import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import { ToastProvider } from "@/components/feedback/toast";
import {
  SessionContext,
  type SessionContextValue,
} from "@/features/auth/session-provider";
import type { SessionUser } from "@/types/session";

export const authenticatedCustomer: SessionUser = {
  id: "user_1",
  displayName: "کاربر آزمایشی",
  permissionCodes: [],
  adminPanelAccess: "denied",
};

export const authenticatedAdmin: SessionUser = {
  id: "staff_1",
  displayName: "مدیر آزمایشی",
  permissionCodes: [],
  adminPanelAccess: "granted",
};

export function createSessionValue(
  overrides: Partial<SessionContextValue> = {},
): SessionContextValue {
  return {
    status: "authenticated",
    user: authenticatedCustomer,
    refetch: async () => undefined,
    applyAuthenticated: () => undefined,
    logout: async () => undefined,
    ...overrides,
  };
}

export function renderWithProviders(
  ui: ReactElement,
  {
    session = createSessionValue(),
    queryClient,
    ...renderOptions
  }: Omit<RenderOptions, "wrapper"> & {
    session?: SessionContextValue;
    queryClient?: QueryClient;
  } = {},
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider
        client={
          queryClient ??
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <ToastProvider>
          <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    ),
    ...renderOptions,
  });
}
