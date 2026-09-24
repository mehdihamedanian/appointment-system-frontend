"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import {
  ApiErrorState,
  BackendDependencyState,
  ConflictState,
  EmptyState,
  FeatureDisabledState,
  NoResultsState,
  NotFoundState,
  PermissionDeniedState,
  SessionExpiredState,
} from "@/components/feedback/app-states";
import { Button } from "@/components/ui/button";
import { classifyApiError, type ApiErrorKind } from "@/lib/api/error-ui";
import { SessionExpiredLoginLink } from "@/features/auth/session-expired-login-link";

/**
 * Renders the correct UX state for a classified API error (Phase 44 precedence helper).
 * Does not replace auth/permission gates — call those first.
 */
export function QueryErrorState({
  error,
  onRetry,
  notFoundAction,
}: {
  error: unknown;
  onRetry?: () => void;
  notFoundAction?: ReactNode;
}) {
  const classified = classifyApiError(error);
  const retry = classified.safeToRetry ? onRetry : undefined;

  switch (classified.kind as ApiErrorKind) {
    case "session_expired":
      return (
        <SessionExpiredState
          title={classified.title}
          description={classified.description}
          action={
            <Suspense fallback={null}>
              <SessionExpiredLoginLink />
            </Suspense>
          }
        />
      );
    case "unauthorized":
      return (
        <SessionExpiredState
          title={classified.title}
          description={classified.description}
          action={
            <Suspense fallback={null}>
              <SessionExpiredLoginLink />
            </Suspense>
          }
        />
      );
    case "forbidden":
      return (
        <PermissionDeniedState
          title={classified.title}
          description={classified.description}
        />
      );
    case "not_found":
      return (
        <NotFoundState
          title={classified.title}
          description={classified.description}
          action={notFoundAction}
        />
      );
    case "conflict":
      return (
        <ConflictState
          title={classified.title}
          description={classified.description}
          onRefresh={onRetry}
        />
      );
    case "feature_disabled":
      return (
        <FeatureDisabledState
          title={classified.title}
          description={classified.description}
        />
      );
    case "backend_dependency":
      return (
        <BackendDependencyState
          title={classified.title}
          description={classified.description}
          requestId={classified.requestId}
        />
      );
    default:
      return (
        <ApiErrorState
          title={classified.title}
          description={classified.description}
          requestId={classified.requestId}
          onRetry={retry}
        />
      );
  }
}

export function ListQueryState({
  isPending,
  error,
  isEmpty,
  hasActiveFilters,
  onRetry,
  onClearFilters,
  skeleton,
  emptyTitle,
  emptyDescription,
  emptyAction,
  noResultsTitle,
  noResultsDescription,
  children,
}: {
  isPending: boolean;
  error?: unknown;
  isEmpty: boolean;
  hasActiveFilters?: boolean;
  onRetry?: () => void;
  onClearFilters?: () => void;
  skeleton: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  noResultsTitle?: string;
  noResultsDescription?: string;
  children: ReactNode;
}) {
  if (isPending) {
    return <>{skeleton}</>;
  }
  if (error) {
    return <QueryErrorState error={error} onRetry={onRetry} />;
  }
  if (isEmpty && hasActiveFilters) {
    return (
      <NoResultsState
        title={noResultsTitle}
        description={noResultsDescription}
        action={
          onClearFilters ? (
            <Button type="button" variant="secondary" onClick={onClearFilters}>
              پاک کردن فیلترها
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (isEmpty) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }
  return <>{children}</>;
}
