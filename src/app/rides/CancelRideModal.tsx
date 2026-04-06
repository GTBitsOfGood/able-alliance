"use client";

import React from "react";
import { Dialog } from "radix-ui";
import BogButton from "@/components/BogButton/BogButton";
import bogModalStyles from "@/components/BogModal/styles.module.css";
import { useResponsive } from "@/utils/design-system/hooks/useResponsive";
import { getSizeFromBreakpoint } from "@/utils/design-system/breakpoints/breakpoints";
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
  const breakpoint = useResponsive();
  const responsiveSize = getSizeFromBreakpoint(breakpoint);
  /* to match BogModal */
  const titleTypographyClass =
    responsiveSize === "small"
      ? "text-heading-4"
      : responsiveSize === "medium"
        ? "text-heading-3"
        : "text-heading-2";
  const descriptionTypographyClass =
    responsiveSize === "small" ? "text-paragraph-2" : "text-paragraph-1";

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
          <Dialog.Title
            className={`${styles.cancelRideTitle} ${titleTypographyClass}`}
          >
            Cancel this ride?
          </Dialog.Title>
          <Dialog.Description
            className={`${styles.cancelRideDescription} ${descriptionTypographyClass}`}
          >
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
