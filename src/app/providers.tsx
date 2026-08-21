"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";
import { ToastProvider } from "@/components/feedback/toast";
import { SessionProvider } from "@/features/auth/session-provider";
import { createQueryClient } from "@/lib/query/client";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState<QueryClient>(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionProvider>
          {children}
          <div id="modal-portal" />
        </SessionProvider>
      </ToastProvider>
      {process.env.NODE_ENV === "development" ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}
