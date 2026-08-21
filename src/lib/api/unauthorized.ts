import type { AppApiError } from "@/types/api";

type UnauthorizedHandler = (error: AppApiError) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized(error: AppApiError): void {
  unauthorizedHandler?.(error);
}
