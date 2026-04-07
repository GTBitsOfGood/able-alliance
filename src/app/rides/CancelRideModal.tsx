"use client";

import React from "react";
import { Dialog } from "radix-ui";
import bogModalStyles from "@/components/BogModal/styles.module.css";
import styles from "./styles.module.css";

type CancelRideModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmCancel: () => void | Promise<void>;
  confirming?: boolean;
};

export function CancelRideModal({
  open,
  onOpenChange,
  onConfirmCancel,
  confirming = false,
}: CancelRideModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay
          className={`${bogModalStyles.overlay} ${styles.cancelRideOverlay}`}
        />
        <Dialog.Content
          className={`${bogModalStyles.content} ${styles.cancelRideContent}`}
          onPointerDownOutside={(e) => {
            if (confirming) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (confirming) e.preventDefault();
          }}
          aria-busy={confirming}
        >
          {/* Visually hidden title for accessibility */}
          <Dialog.Title className={styles.srOnly}>
            Cancel ride confirmation
          </Dialog.Title>

          <Dialog.Description className={styles.cancelRideDescription}>
            Are you sure you want to cancel this ride?
          </Dialog.Description>

          <div className={styles.cancelRideActions}>
            <button
              type="button"
              className={styles.cancelModalNevermind}
              disabled={confirming}
              onClick={() => onOpenChange(false)}
            >
              Nevermind
            </button>
            <button
              type="button"
              className={styles.cancelModalConfirm}
              disabled={confirming}
              onClick={() => void onConfirmCancel()}
            >
              {confirming ? "Cancelling…" : "Cancel ride"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
