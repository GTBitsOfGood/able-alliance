"use client";

import React, { useState } from "react";
import BogButton from "@/components/BogButton/BogButton";
import { Shifts } from "./Shifts";
import styles from "./profile.module.css";
import type { UserType } from "@/utils/authUser";

export type ProfileUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  type: UserType;
  studentInfo?: {
    notes?: string | null;
    accessibilityNeeds?: "Wheelchair" | "LowMobility" | null;
  } | null;
  shifts?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
};

function roleLabel(type: UserType): string {
  switch (type) {
    case "Student":
      return "Rider";
    case "Driver":
      return "Driver";
    case "Admin":
    case "SuperAdmin":
      return "Admin";
    default:
      return type;
  }
}

function avatarClass(type: UserType): string {
  switch (type) {
    case "Student":
      return styles.profileAvatarStudent;
    case "Driver":
      return styles.profileAvatarDriver;
    case "Admin":
    case "SuperAdmin":
      return styles.profileAvatarAdmin;
    default:
      return styles.profileAvatarStudent;
  }
}

function accessibilityLabel(
  value: "Wheelchair" | "LowMobility" | null | undefined,
): string {
  if (!value) return "-";
  switch (value) {
    case "Wheelchair":
      return "Wheelchair access needed";
    case "LowMobility":
      return "Low mobility support needed";
    default:
      return "-";
  }
}

const ACCESSIBILITY_OPTIONS: {
  label: string;
  value: "Wheelchair" | "LowMobility" | "";
}[] = [
  { label: "None", value: "" },
  { label: "Wheelchair access needed", value: "Wheelchair" },
  { label: "Low mobility support needed", value: "LowMobility" },
];

export function ProfileView({
  user,
  canEdit = false,
  viewerType = "Student",
}: {
  user: ProfileUser;
  canEdit?: boolean;
  viewerType?: UserType;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [draftNotes, setDraftNotes] = useState(user.studentInfo?.notes ?? "");
  const [draftAccessibility, setDraftAccessibility] = useState<
    "Wheelchair" | "LowMobility" | ""
  >(user.studentInfo?.accessibilityNeeds ?? "");

  const [displayUser, setDisplayUser] = useState(user);

  const avatarLetter =
    displayUser.firstName.trim().charAt(0).toUpperCase() || "?";
  const displayName =
    [displayUser.firstName, displayUser.lastName].filter(Boolean).join(" ") ||
    displayUser.email;
  const showAccommodations = displayUser.type === "Student";

  function handleEdit() {
    setDraftNotes(displayUser.studentInfo?.notes ?? "");
    setDraftAccessibility(displayUser.studentInfo?.accessibilityNeeds ?? "");
    setSaveError(null);
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
    setSaveError(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/users/${displayUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: draftNotes.trim() || null,
          accessibilityNeeds: draftAccessibility || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to save changes");
      }
      setDisplayUser((prev) => ({
        ...prev,
        studentInfo: {
          notes: draftNotes.trim() || null,
          accessibilityNeeds: draftAccessibility || null,
        },
      }));
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.profilePage}>
      <div className={styles.profileInner}>
        <header className={styles.profileHeader}>
          <div
            className={`${styles.profileAvatar} ${avatarClass(displayUser.type)}`}
          >
            {avatarLetter}
          </div>
          <div className={styles.profileNameBlock}>
            <h1 className={styles.profileDisplayName}>{displayName}</h1>
            <span className={styles.profileRole}>
              {roleLabel(displayUser.type)}
            </span>
          </div>
        </header>

        <section className={styles.profileCard}>
          <div className={styles.profileCardHeader}>
            <h2 className={styles.sectionTitle}>Personal Information</h2>
            {editing ? (
              <div className={styles.editActions}>
                <BogButton
                  variant="secondary"
                  size="medium"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancel
                </BogButton>
                <BogButton
                  variant="primary"
                  size="medium"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save changes"}
                </BogButton>
              </div>
            ) : (
              showAccommodations &&
              canEdit && (
                <BogButton
                  variant="secondary"
                  size="medium"
                  onClick={handleEdit}
                >
                  Edit information
                </BogButton>
              )
            )}
          </div>

          {saveError && (
            <p className={styles.saveError} role="alert">
              {saveError}
            </p>
          )}

          <div className={styles.profileFieldGrid}>
            <div className={styles.profileField}>
              <span className={styles.fieldLabel}>First name</span>
              {editing ? (
                <input
                  className={styles.inlineInput}
                  value={displayUser.firstName || ""}
                  disabled
                  readOnly
                />
              ) : (
                <span className={styles.fieldValue}>
                  {displayUser.firstName || "-"}
                </span>
              )}
            </div>
            <div className={styles.profileField}>
              <span className={styles.fieldLabel}>Last name</span>
              {editing ? (
                <input
                  className={styles.inlineInput}
                  value={displayUser.lastName || ""}
                  disabled
                  readOnly
                />
              ) : (
                <span className={styles.fieldValue}>
                  {displayUser.lastName || "-"}
                </span>
              )}
            </div>
            <div className={styles.profileField}>
              <span className={styles.fieldLabel}>Email</span>
              {editing ? (
                <input
                  className={styles.inlineInput}
                  value={displayUser.email}
                  disabled
                  readOnly
                />
              ) : (
                <span className={styles.fieldValue}>{displayUser.email}</span>
              )}
            </div>
          </div>

          {showAccommodations && (
            <section className={styles.profileSection}>
              <h3 className={styles.sectionSubtitle}>Accommodations</h3>
              <div className={styles.sectionBody}>
                <div className={styles.sectionRow}>
                  <span className={styles.sectionRowLabel}>
                    Disabilities and accommodations
                  </span>
                  {editing ? (
                    <select
                      className={styles.inlineSelect}
                      value={draftAccessibility}
                      onChange={(e) =>
                        setDraftAccessibility(
                          e.target.value as "Wheelchair" | "LowMobility" | "",
                        )
                      }
                    >
                      {ACCESSIBILITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={styles.sectionRowValue}>
                      {accessibilityLabel(
                        displayUser.studentInfo?.accessibilityNeeds ?? null,
                      )}
                    </span>
                  )}
                </div>
                <div className={styles.sectionRow}>
                  <span className={styles.sectionRowLabel}>
                    Additional comments
                  </span>
                  {editing ? (
                    <textarea
                      className={styles.inlineTextarea}
                      placeholder="Enter any other comments you would like the driver to know about"
                      value={draftNotes}
                      onChange={(e) => setDraftNotes(e.target.value)}
                      rows={4}
                    />
                  ) : (
                    <span className={styles.sectionRowValue}>
                      {displayUser.studentInfo?.notes?.trim() || "-"}
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}
        </section>

        <Shifts
          user={displayUser}
          canEdit={canEdit}
          viewerType={viewerType}
          onUpdate={(shifts) => {
            setDisplayUser((prev) => ({ ...prev, shifts }));
          }}
        />
      </div>
    </div>
  );
}
