type RequestInfo = {
  path: string;
  method: string;
};

type ErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
};

export type RequestErrorLog = {
  level: "error";
  event: "request_error";
  timestamp: string;
  digest?: string;
  name: string;
  message: string;
  method: string;
  path: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
};

const MAX_MESSAGE_LENGTH = 300;

/**
 * One log line per server error. Query strings (reset tokens, references), headers
 * and cookies are never included; the digest matches the reference shown to the user.
 */
export function toRequestErrorLog(
  error: unknown,
  request: RequestInfo,
  context: ErrorContext,
  now = new Date(),
): RequestErrorLog {
  const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const digest = typeof record.digest === "string" ? record.digest : undefined;
  const name = error instanceof Error ? error.name : "NonError";
  const message = (error instanceof Error ? error.message : String(error)).slice(0, MAX_MESSAGE_LENGTH);

  return {
    level: "error",
    event: "request_error",
    timestamp: now.toISOString(),
    digest,
    name,
    message,
    method: request.method,
    path: request.path.split("?")[0] ?? "",
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  };
}
