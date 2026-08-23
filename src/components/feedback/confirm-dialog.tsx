"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/feedback/modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "destructive";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "تأیید",
  cancelLabel = "انصراف",
  variant = "destructive",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const tone = variant === "primary" ? "primary" : "destructive";

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      size="sm"
      preventClose={busy}
      showClose={!busy}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone}
            loading={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
