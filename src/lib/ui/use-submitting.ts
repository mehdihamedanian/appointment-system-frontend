"use client";

import { useRef, useState } from "react";

/**
 * Shared duplicate-submit lock for forms and destructive actions (Phase 44).
 */
export function useSubmitting() {
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);

  async function run(task: () => Promise<void>) {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setSubmitting(true);
    try {
      await task();
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  }

  return { submitting, run };
}
