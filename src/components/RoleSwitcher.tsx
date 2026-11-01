"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { DropdownMenu } from "radix-ui";
import { userTypeHome, userTypeLabel } from "@/utils/userTypes";
import type { UserType } from "@db/generated/enums";
import styles from "./RoleSwitcher.module.css";

export default function RoleSwitcher() {
  const { data: session, status, update } = useSession();
  const [switching, setSwitching] = useState(false);
  const switchingRef = useRef(false);
  const [error, setError] = useState("");
  const sessionLoading = status === "loading";
  if (!session?.user) return null;
  const { activeType, types } = session.user;
  if (types.length < 2) return null;

  async function switchRole(role: string) {
    if (role === activeType || switchingRef.current) return;
    switchingRef.current = true;
    setSwitching(true);
    setError("");
    try {
      const updated = await update({ activeType: role });
      if (!updated?.user || updated.user.activeType !== role) {
        throw new Error("Unable to switch to this account type");
      }
      // A full navigation clears role-specific cached data and chat connections.
      window.location.assign(userTypeHome(updated.user.activeType));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to switch roles",
      );
      setSwitching(false);
      switchingRef.current = false;
    }
  }

  return (
    <div className={styles.wrapper}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={styles.trigger}
          disabled={switching || sessionLoading}
          aria-label={`Switch role, currently ${userTypeLabel(activeType)}`}
        >
          <span>{switching ? "Switching…" : userTypeLabel(activeType)}</span>
          <span aria-hidden="true">⌄</span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={styles.menu}
            sideOffset={8}
            align="end"
            collisionPadding={12}
          >
            <DropdownMenu.Label className={styles.label}>
              Switch role
            </DropdownMenu.Label>
            <DropdownMenu.RadioGroup
              value={activeType}
              onValueChange={switchRole}
            >
              {types.map((role: UserType) => (
                <DropdownMenu.RadioItem
                  className={styles.item}
                  value={role}
                  key={role}
                >
                  <span>{userTypeLabel(role)}</span>
                  <DropdownMenu.ItemIndicator aria-hidden="true">
                    ✓
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
