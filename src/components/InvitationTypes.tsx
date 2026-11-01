"use client";

import { DropdownMenu } from "radix-ui";
import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import type { UserType } from "@db/generated/enums";
import { USER_TYPES, userTypeLabel, isAdmin } from "@/utils/userTypes";
import styles from "./InvitationTypes.module.css";

const descriptions: Record<UserType, string> = {
  Student: "Request and manage personal rides",
  Driver: "View assigned rides and transport students",
  Admin: "Manage rides, users, vehicles, and locations",
  SuperAdmin: "Admin access, plus invite administrators",
};

export default function InvitationTypes({
  value,
  onChange,
  canInviteAdmins,
  disabled = false,
}: {
  value: UserType[];
  onChange: (types: UserType[]) => void;
  canInviteAdmins: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`${styles.field} text-paragraph-2`}>
      <span id="invite-types-label" className={styles.label}>
        Account types&nbsp;
        <span className={styles.required} aria-hidden="true">
          *
        </span>
      </span>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          type="button"
          className={styles.trigger}
          data-placeholder={value.length === 0 ? "" : undefined}
          disabled={disabled}
          aria-labelledby="invite-types-label invite-types-value"
          aria-describedby="invite-types-help"
        >
          <span id="invite-types-value" className={styles.value}>
            {value.length
              ? value.map(userTypeLabel).join(", ")
              : "Select account types"}
          </span>
          <ChevronDownIcon aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={styles.menu}
            align="start"
            sideOffset={8}
            collisionPadding={12}
          >
            {USER_TYPES.map((type) => {
              const restricted = isAdmin(type) && !canInviteAdmins;
              return (
                <DropdownMenu.CheckboxItem
                  key={type}
                  className={styles.option}
                  checked={value.includes(type)}
                  disabled={restricted}
                  textValue={userTypeLabel(type)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked
                        ? USER_TYPES.filter(
                            (option) =>
                              option === type || value.includes(option),
                          )
                        : value.filter((option) => option !== type),
                    )
                  }
                >
                  <span className={styles.check}>
                    <DropdownMenu.ItemIndicator>
                      <CheckIcon />
                    </DropdownMenu.ItemIndicator>
                  </span>
                  <span>
                    <span className={styles.optionTitle}>
                      {userTypeLabel(type)}
                    </span>
                    <span className={styles.description}>
                      {restricted
                        ? "Only Super Admins can assign this type"
                        : descriptions[type]}
                    </span>
                  </span>
                </DropdownMenu.CheckboxItem>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <p id="invite-types-help" className={styles.help}>
        Choose all that apply. Types cannot be changed after invitation.
      </p>
    </div>
  );
}
