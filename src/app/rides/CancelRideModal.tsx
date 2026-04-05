"use client";

import React from "react";
import { Dialog } from "radix-ui";
import BogButton from "@/components/BogButton/BogButton";
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
          className={`${bogModalStyles.content} ${bogModalStyles.medium} ${styles.cancelRideContent}`}
          onPointerDownOutside={(e) => {
            if (confirming) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (confirming) e.preventDefault();
          }}
          aria-busy={confirming}
        >
          <Dialog.Title className={styles.cancelRideTitle}>
            Cancel this ride?
          </Dialog.Title>
          <Dialog.Description className={styles.cancelRideDescription}>
            Are you sure you want to cancel this ride?
          </Dialog.Description>
          <div className={styles.cancelRideActions}>
            <BogButton
              type="button"
              variant="secondary"
              size="medium"
              disabled={confirming}
              onClick={() => onOpenChange(false)}
            >
              Nevermind
            </BogButton>
            <BogButton
              type="button"
              variant="primary"
              size="medium"
              disabled={confirming}
              onClick={() => {
                void onConfirmCancel();
              }}
            >
              {confirming ? "Cancelling…" : "Cancel ride"}
            </BogButton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
