"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Lazy secondary structured viewer — not the primary diff experience. */
export function AdminActivityLogStructuredPreview({ value }: { value: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section
      className="admin-activity-log-structured"
      aria-labelledby="activity-log-structured-title"
    >
      <div className="admin-activity-log-structured__head">
        <h2 id="activity-log-structured-title" className="text-card-title">
          داده ساخت‌یافته (اختیاری)
        </h2>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          {open ? "بستن" : "نمایش"}
        </Button>
      </div>
      {open ? (
        <pre className="admin-activity-log-structured__pre ltr-value" tabIndex={0}>
          {value}
        </pre>
      ) : (
        <p className="ds-help">برای بررسی ثانویه، نمایش را باز کنید. HTML ناامن رندر نمی‌شود.</p>
      )}
    </section>
  );
}
