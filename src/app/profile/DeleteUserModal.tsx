"use client";

import React from "react";
import { Dialog } from "radix-ui";
import bogModalStyles from "@/components/BogModal/styles.module.css";
import styles from "./deleteModal.module.css";

type DeleteUserModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void | Promise<void>;
  confirming?: boolean;
};

export function DeleteUserModal({
  open,
  onOpenChange,
  onConfirmDelete,
  confirming = false,
}: DeleteUserModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay
          className={`${bogModalStyles.overlay} ${styles.overlay}`}
        />
        <Dialog.Content
          className={`${bogModalStyles.content} ${styles.content}`}
          onPointerDownOutside={(e) => {
            if (confirming) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (confirming) e.preventDefault();
          }}
          aria-busy={confirming}
        >
          <Dialog.Title className={styles.srOnly}>
            Delete user confirmation
          </Dialog.Title>

          <Dialog.Description className={styles.description}>
            Are you sure you want to delete this user? This action cannot be
            undone.
          </Dialog.Description>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.nevermind}
              disabled={confirming}
              onClick={() => onOpenChange(false)}
            >
              Nevermind
            </button>
            <button
              type="button"
              className={styles.confirm}
              disabled={confirming}
              onClick={() => void onConfirmDelete()}
            >
              {confirming ? "Deleting…" : "Delete user"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
