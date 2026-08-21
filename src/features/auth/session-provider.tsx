"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isSessionExpiredError } from "@/lib/api/errors";
import { setUnauthorizedHandler } from "@/lib/api/unauthorized";
import {
  clearFrontendCaches,
  logoutRemote,
  sessionQueryOptions,
} from "@/lib/auth/session";
import type { ResolvedSession, SessionStatus, SessionUser } from "@/types/session";

type SessionContextValue = {
  status: SessionStatus;
  user: SessionUser | null;
  message?: string;
  refetch: () => Promise<unknown>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery(sessionQueryOptions);

  const snapshot: ResolvedSession = query.data ?? {
    status: "unauthenticated",
    user: null,
  };

  const status: SessionStatus = query.isPending ? "loading" : snapshot.status;

  const logout = useCallback(async () => {
    await logoutRemote();
    clearFrontendCaches(queryClient);
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler((error) => {
      queryClient.setQueryData(sessionQueryOptions.queryKey, {
        status: isSessionExpiredError(error) ? "expired" : "unauthenticated",
        user: null,
        requestId: error.requestId,
        message: error.message,
      } satisfies ResolvedSession);
    });

    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      user: snapshot.user,
      message: snapshot.message,
      refetch: query.refetch,
      logout,
    }),
    [logout, query.refetch, snapshot.message, snapshot.user, status],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return value;
}

export { SessionContext };
export type { SessionContextValue };
