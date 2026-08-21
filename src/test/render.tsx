import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
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
    logout: async () => undefined,
    ...overrides,
  };
}

function Providers({
  children,
  session,
}: {
  children: ReactNode;
  session: SessionContextValue;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionContext.Provider value={session}>
          {children}
        </SessionContext.Provider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  {
    session = createSessionValue(),
    ...renderOptions
  }: Omit<RenderOptions, "wrapper"> & { session?: SessionContextValue } = {},
) {
  return render(ui, {
    wrapper: ({ children }) => <Providers session={session}>{children}</Providers>,
    ...renderOptions,
  });
}
