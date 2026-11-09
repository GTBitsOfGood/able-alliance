"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { DropdownMenu } from "radix-ui";
import { CheckIcon } from "@radix-ui/react-icons";
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
          aria-busy={switching}
        >
          <Image
            className={styles.buttonIcon}
            src="/role-switcher/button.svg"
            alt=""
            width={76}
            height={76}
          />
          <span className={styles.tooltip} aria-hidden="true">
            {switching ? "Switching…" : "Switch role"}
          </span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={styles.menu}
            side="top"
            sideOffset={8}
            align="center"
            collisionPadding={12}
            aria-label="Switch role"
          >
            <DropdownMenu.RadioGroup
              value={activeType}
              onValueChange={switchRole}
            >
              {types.map((role: UserType) => (
                <DropdownMenu.RadioItem
                  className={styles.item}
                  value={role}
                  key={role}
                  disabled={switching || sessionLoading}
                >
                  <span className={styles.indicator}>
                    <DropdownMenu.ItemIndicator asChild>
                      <CheckIcon aria-hidden="true" width={24} height={24} />
                    </DropdownMenu.ItemIndicator>
                  </span>
                  <span>{userTypeLabel(role)}</span>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Arrow
              className={styles.menuArrow}
              width={27}
              height={13}
            />
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
