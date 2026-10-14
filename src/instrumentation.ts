import type { Instrumentation } from "next";
import { toRequestErrorLog } from "@/lib/observability/request-error";

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  console.error(JSON.stringify(toRequestErrorLog(error, request, context)));
};
