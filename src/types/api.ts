export type AppApiError = {
  status: number;
  code?: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
};

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiQueryValue = string | number | boolean | null | undefined;

export type ApiRequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  timeoutMs?: number;
  credentials?: RequestCredentials;
  query?: Record<string, ApiQueryValue>;
};
