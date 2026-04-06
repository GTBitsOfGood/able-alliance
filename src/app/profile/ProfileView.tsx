"use client";

import React, { useState, useEffect } from "react";
import BogButton from "@/components/BogButton/BogButton";
import styles from "./profile.module.css";

type UserType = "Student" | "Driver" | "Admin" | "SuperAdmin";

export type AccessibilityNeed = string;

export type ProfileUser = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  email: string;
  type: UserType;
  studentInfo?: {
    notes?: string | null;
    accessibilityNeeds?: AccessibilityNeed[] | null;
  } | null;
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

export function ProfileView({
  user,
  canEdit = false,
}: {
  user: ProfileUser;
  canEdit?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [draftPreferredName, setDraftPreferredName] = useState(
    user.preferredName ?? "",
  );
  const [draftNotes, setDraftNotes] = useState(user.studentInfo?.notes ?? "");
  const [draftAccessibility, setDraftAccessibility] = useState<
    AccessibilityNeed[]
  >(user.studentInfo?.accessibilityNeeds ?? []);

  const [displayUser, setDisplayUser] = useState(user);
  const [accommodationOptions, setAccommodationOptions] = useState<string[]>(
    [],
  );

  useEffect(() => {
    if (user.type === "Student") {
      fetch("/api/accommodations")
        .then((r) => r.json())
        .then((data: { label: string }[]) =>
          setAccommodationOptions(data.map((d) => d.label)),
        )
        .catch(() => {});
    }
  }, [user.type]);

  const avatarLetter =
    displayUser.firstName.trim().charAt(0).toUpperCase() || "?";
  const displayName =
    [displayUser.firstName, displayUser.lastName].filter(Boolean).join(" ") ||
    displayUser.email;
  const showAccommodations = displayUser.type === "Student";

  function handleEdit() {
    setDraftPreferredName(displayUser.preferredName ?? "");
    setDraftNotes(displayUser.studentInfo?.notes ?? "");
    setDraftAccessibility(displayUser.studentInfo?.accessibilityNeeds ?? []);
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
      const patchBody: Record<string, unknown> = {
        preferredName: draftPreferredName.trim() || null,
      };
      if (showAccommodations) {
        patchBody.notes = draftNotes.trim() || null;
        patchBody.accessibilityNeeds =
          draftAccessibility.length > 0 ? draftAccessibility : null;
      }
      const res = await fetch(`/api/users/${displayUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to save changes");
      }
      setDisplayUser((prev) => ({
        ...prev,
        preferredName: draftPreferredName.trim() || null,
        studentInfo: showAccommodations
          ? {
              notes: draftNotes.trim() || null,
              accessibilityNeeds:
                draftAccessibility.length > 0 ? draftAccessibility : null,
            }
          : prev.studentInfo,
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
              <span className={styles.fieldLabel}>Preferred name</span>
              {editing ? (
                <input
                  className={styles.inlineInput}
                  value={draftPreferredName}
                  onChange={(e) => setDraftPreferredName(e.target.value)}
                  placeholder="Optional"
                />
              ) : (
                <span className={styles.fieldValue}>
                  {displayUser.preferredName?.trim() || "-"}
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
                    <div className={styles.checkboxGroup}>
                      {accommodationOptions.map((opt) => (
                        <label key={opt} className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            className={styles.checkboxInput}
                            checked={draftAccessibility.includes(opt)}
                            onChange={(e) => {
                              setDraftAccessibility(
                                e.target.checked
                                  ? [...draftAccessibility, opt]
                                  : draftAccessibility.filter((v) => v !== opt),
                              );
                            }}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.sectionRowValue}>
                      {(displayUser.studentInfo?.accessibilityNeeds ?? [])
                        .length > 0
                        ? (
                            displayUser.studentInfo?.accessibilityNeeds ?? []
                          ).join(", ")
                        : "-"}
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
      </div>
    </div>
  );
}
