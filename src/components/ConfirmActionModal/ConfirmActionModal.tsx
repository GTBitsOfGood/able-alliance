"use client";

import React from "react";
import BogModal from "@/components/BogModal/BogModal";
import BogButton from "@/components/BogButton/BogButton";
import BogIcon from "@/components/BogIcon/BogIcon";

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
  /** Confirm button color: "destructive" (red, default) or "primary" (navy)
   *  for non-destructive confirmations. */
  variant?: "destructive" | "primary";
};

/**
 * Confirmation dialog for destructive or hard-to-reverse admin actions
 * (ride cancellation, user/vehicle/location archiving). Built on BogModal
 * with the standard palette: navy dismiss button, red confirm button.
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
  variant = "destructive",
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
      contentProps={{
        style: {
          width: "60rem",
          maxWidth: "90vw",
          padding: "4.8rem 2.88rem",
          borderRadius: "0.8rem",
          gap: "2rem",
          boxShadow: "0 0.72rem 3.012rem -0.24rem rgba(0, 0, 0, 0.16)",
        },
      }}
      closeButton={<BogIcon name="x" size={36} />}
      title={
        <h3
          style={{
            fontSize: "3.2rem",
            lineHeight: "4rem",
            color: "var(--color-grey-text-strong)",
          }}
        >
          {title}
        </h3>
      }
    >
      <div className="flex flex-col gap-[4.8rem]">
        <p className="m-0 text-paragraph-1 text-[var(--color-grey-text-weak)]">
          {description}
        </p>
        <div className="flex flex-wrap justify-end gap-[1.6rem]">
          <BogButton
            variant="secondary"
            size="large"
            disabled={confirming}
            onClick={() => setOpen(false)}
            style={{ fontWeight: 600 }}
          >
            {cancelLabel}
          </BogButton>
          <BogButton
            variant="primary"
            size="large"
            disabled={confirming}
            onClick={() => void onConfirm()}
            style={{
              fontWeight: 600,
              ...(variant === "destructive"
                ? {
                    "--color-brand-text": "var(--color-status-red-text)",
                    "--color-brand-hover":
                      "var(--color-status-red-stroke-strong)",
                  }
                : {}),
            }}
          >
            {confirming ? (confirmingLabel ?? confirmLabel) : confirmLabel}
          </BogButton>
        </div>
      </div>
    </BogModal>
  );
}
