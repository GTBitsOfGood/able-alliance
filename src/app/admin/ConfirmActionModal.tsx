"use client";

import React from "react";
import BogModal from "@/components/BogModal/BogModal";
import BogButton from "@/components/BogButton/BogButton";

type ConfirmActionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  /** Modal heading, e.g. "Cancel this ride?" */
  title: string;
  /** Body copy explaining what the action does. */
  description: React.ReactNode;
  /** Label for the destructive confirm button, e.g. "Cancel ride". */
  confirmLabel: string;
  /** Label shown on the confirm button while the request is in flight. */
  confirmingLabel?: string;
  /** Label for the dismiss button. */
  cancelLabel?: string;
  /** True while the confirmed request is running — disables the buttons and
   *  prevents the modal from being dismissed. */
  confirming?: boolean;
};

/**
 * Confirmation dialog for destructive admin actions (ride cancellation,
 * user/vehicle deletion). Built on BogModal with the standard palette:
 * navy dismiss button, red confirm button.
 */
export default function ConfirmActionModal({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmingLabel,
  cancelLabel = "Nevermind",
  confirming = false,
}: ConfirmActionModalProps) {
  // While the request is in flight, don't let the modal be dismissed
  // (Escape, outside click, or the close button).
  const setOpen = (value: React.SetStateAction<boolean>) => {
    const next = typeof value === "function" ? value(open) : value;
    if (confirming && !next) return;
    onOpenChange(next);
  };

  return (
    <BogModal
      size="medium"
      modal
      openState={{ open, setOpen }}
      trigger={
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          style={{ display: "none" }}
        />
      }
      title={<h3>{title}</h3>}
    >
      <div className="flex flex-col gap-[2.4rem]">
        <p className="m-0 text-paragraph-1 text-[var(--color-grey-text-strong)]">
          {description}
        </p>
        <div className="flex flex-wrap justify-end gap-[1.2rem]">
          <BogButton
            variant="secondary"
            size="medium"
            disabled={confirming}
            onClick={() => setOpen(false)}
            style={{ borderRadius: "0.5rem" }}
          >
            {cancelLabel}
          </BogButton>
          <BogButton
            variant="primary"
            size="medium"
            disabled={confirming}
            onClick={() => void onConfirm()}
            style={
              {
                "--color-brand-text": "var(--color-status-red-text)",
                "--color-brand-hover": "var(--color-status-red-stroke-strong)",
                borderRadius: "0.5rem",
              } as React.CSSProperties
            }
          >
            {confirming ? (confirmingLabel ?? confirmLabel) : confirmLabel}
          </BogButton>
        </div>
      </div>
    </BogModal>
  );
}
