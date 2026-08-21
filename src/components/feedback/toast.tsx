"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

type ToastKind = "success" | "error" | "warning" | "info" | "loading";

type ToastRecord = {
  id: string;
  kind: ToastKind;
  message: string;
  duration: number;
};

type ToastOptions = {
  duration?: number;
  id?: string;
};

type ToastApi = {
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  loading: (message: string, options?: ToastOptions) => string;
  dismiss: (id?: string) => void;
  promise: <T>(
    value: Promise<T>,
    labels: { loading: string; success: string; error: string },
  ) => Promise<T>;
};

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 4500;

const ToastContext = createContext<ToastApi | null>(null);
let toastBridge: ToastApi | null = null;

function createId(): string {
  return `toast-${Math.random().toString(36).slice(2, 9)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef<Record<string, number>>({});

  const dismiss = useCallback((id?: string) => {
    setToasts((current) => {
      if (!id) {
        current.forEach((toast) => window.clearTimeout(timers.current[toast.id]));
        timers.current = {};
        return [];
      }
      window.clearTimeout(timers.current[id]);
      delete timers.current[id];
      return current.filter((toast) => toast.id !== id);
    });
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, options?: ToastOptions) => {
      const id = options?.id ?? createId();
      const duration =
        kind === "loading" ? 0 : (options?.duration ?? DEFAULT_DURATION);

      setToasts((current) => {
        const next = [
          ...current.filter((toast) => toast.id !== id),
          { id, kind, message, duration },
        ];
        return next.slice(-MAX_TOASTS);
      });

      window.clearTimeout(timers.current[id]);
      if (duration > 0) {
        timers.current[id] = window.setTimeout(() => dismiss(id), duration);
      }

      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, options) => push("success", message, options),
      error: (message, options) => push("error", message, options),
      warning: (message, options) => push("warning", message, options),
      info: (message, options) => push("info", message, options),
      loading: (message, options) => push("loading", message, options),
      dismiss,
      promise: async (value, labels) => {
        const id = push("loading", labels.loading);
        try {
          const result = await value;
          push("success", labels.success, { id });
          return result;
        } catch (error) {
          push("error", labels.error, { id });
          throw error;
        }
      },
    }),
    [dismiss, push],
  );

  useEffect(() => {
    toastBridge = api;
    return () => {
      if (toastBridge === api) {
        toastBridge = null;
      }
    };
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-viewport">
        <div
          className="visually-hidden"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {toasts
            .filter((toast) => toast.kind !== "error")
            .map((toast) => toast.message)
            .join(" ")}
        </div>
        <div
          className="visually-hidden"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          {toasts
            .filter((toast) => toast.kind === "error")
            .map((toast) => toast.message)
            .join(" ")}
        </div>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.kind}`}
            data-kind={toast.kind}
          >
            <span aria-hidden="true">{toast.kind === "loading" ? "…" : ""}</span>
            <p>{toast.message}</p>
            <IconButton label="بستن اعلان" onClick={() => dismiss(toast.id)}>
              <X size={16} />
            </IconButton>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return value;
}

export const toast: ToastApi = {
  success: (message, options) => toastBridge?.success(message, options) ?? "",
  error: (message, options) => toastBridge?.error(message, options) ?? "",
  warning: (message, options) => toastBridge?.warning(message, options) ?? "",
  info: (message, options) => toastBridge?.info(message, options) ?? "",
  loading: (message, options) => toastBridge?.loading(message, options) ?? "",
  dismiss: (id) => toastBridge?.dismiss(id),
  promise: (value, labels) => {
    if (!toastBridge) {
      return value;
    }
    return toastBridge.promise(value, labels);
  },
};
