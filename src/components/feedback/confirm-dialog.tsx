"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/feedback/modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  /** Optional consequence / policy line shown under the description. */
  consequence?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * `destructive` / `danger` — high-impact actions (cancel, refund, delete).
   * `primary` — ordinary reversible confirms (save impact preview, mark-all-read).
   * Initial focus prefers Cancel for destructive variants (`data-confirm-safe-action`).
   */
  variant?: "danger" | "primary" | "destructive";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  consequence,
  confirmLabel = "تأیید",
  cancelLabel = "انصراف",
  variant = "destructive",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const tone = variant === "primary" ? "primary" : "destructive";
  const isDestructive = tone === "destructive";
  const consequenceId = useId();

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      size="sm"
      preventClose={busy}
      showClose={!busy}
      onClose={onCancel}
      describedBy={consequence ? consequenceId : undefined}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={busy}
            data-confirm-safe-action={isDestructive ? "true" : undefined}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone}
            loading={busy}
            disabled={busy}
            onClick={() => {
              if (busy) return;
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {consequence ? (
        <p id={consequenceId} className="confirm-dialog__consequence">
          {consequence}
        </p>
      ) : null}
    </Modal>
  );
}
