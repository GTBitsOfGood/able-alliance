"use client";

import React, { useState, useEffect } from "react";
import BogButton from "@/components/BogButton/BogButton";
import { Shifts } from "./Shifts";
import styles from "./profile.module.css";
import type { UserType } from "@/utils/authUser";

type ProfileTab = "profile" | "rides";

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

export function ProfileView({
  user,
  canEdit = false,
  viewerType = "Student",
}: {
  user: ProfileUser;
  canEdit?: boolean;
  viewerType?: UserType;
}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
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
        {/* Header */}
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

        {/* Tabs */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tab} ${activeTab === "profile" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            Profile
          </button>
          <button
            className={`${styles.tab} ${activeTab === "rides" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("rides")}
          >
            Rides
          </button>
        </div>

        {/* Rides tab — blank for now */}
        {activeTab === "rides" && <div className={styles.ridesPlaceholder} />}

        {/* Card */}
        {activeTab === "profile" && (
          <section className={styles.profileCard}>
            {/* Card header */}
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

            {/* Personal info fields */}
            <div className={styles.profileFieldRows}>
              {/* Row 1: First + Last name */}
              <div className={styles.profileFieldRow}>
                <div className={styles.profileField}>
                  <span className={styles.fieldLabel}>First Name</span>
                  {editing ? (
                    <input
                      className={styles.inlineInputDisabled}
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
                  <span className={styles.fieldLabel}>Last Name</span>
                  {editing ? (
                    <input
                      className={styles.inlineInputDisabled}
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
              </div>

              {/* Row 2: Preferred name */}
              <div className={styles.profileFieldRow}>
                <div className={styles.profileFieldHalf}>
                  <span className={styles.fieldLabel}>Preferred Name</span>
                  {editing ? (
                    <input
                      className={styles.inlineInputEditable}
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
              </div>

              {/* Row 3: GT Email */}
              <div className={styles.profileFieldRow}>
                <div className={styles.profileFieldHalf}>
                  <span className={styles.fieldLabel}>GT Email</span>
                  {editing ? (
                    <input
                      className={styles.inlineInputDisabled}
                      value={displayUser.email}
                      disabled
                      readOnly
                    />
                  ) : (
                    <span className={styles.fieldValue}>
                      {displayUser.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Accommodations section */}
            {showAccommodations && (
              <section className={styles.profileSection}>
                <h3 className={styles.sectionSubtitle}>Accommodations</h3>
                <div className={styles.sectionBody}>
                  {/* Accommodations field */}
                  <div className={styles.sectionRow}>
                    <span className={styles.sectionRowLabel}>
                      Accommodations
                    </span>
                    {editing ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.8rem",
                        }}
                      >
                        <div style={{ position: "relative" }}>
                          <select
                            value=""
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val && !draftAccessibility.includes(val)) {
                                setDraftAccessibility([
                                  ...draftAccessibility,
                                  val,
                                ]);
                              }
                            }}
                            style={{
                              width: "100%",
                              padding: "0.75rem 1rem",
                              paddingRight: "2.4rem",
                              appearance: "none",
                              border: "1px solid var(--color-grey-stroke-weak)",
                              borderRadius: "0.4rem",
                              fontSize: "1.4rem",
                              fontFamily: "var(--font-paragraph)",
                              color: "var(--color-grey-text-weak)",
                              background: "var(--color-solid-bg-sunken)",
                              cursor: "pointer",
                              outline: "none",
                            }}
                          >
                            <option value="" disabled>
                              Select from list
                            </option>
                            {accommodationOptions
                              .filter(
                                (opt) => !draftAccessibility.includes(opt),
                              )
                              .map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                          </select>
                          <span
                            style={{
                              position: "absolute",
                              right: "1rem",
                              top: "50%",
                              transform: "translateY(-50%)",
                              pointerEvents: "none",
                              width: "1.2rem",
                              height: "1.2rem",
                              display: "inline-block",
                              backgroundColor: "var(--color-grey-text-weak)",
                              clipPath:
                                "polygon(20% 35%, 50% 65%, 80% 35%, 90% 45%, 50% 80%, 10% 45%)",
                            }}
                          />
                        </div>
                        {draftAccessibility.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "0.8rem",
                            }}
                          >
                            {draftAccessibility.map((opt) => (
                              <span
                                key={opt}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.6rem",
                                  padding: "0.5rem 1rem",
                                  border:
                                    "1px solid var(--color-grey-stroke-weak)",
                                  borderRadius: "0.4rem",
                                  fontSize: "1.4rem",
                                  fontFamily: "var(--font-paragraph)",
                                  background: "var(--color-solid-bg-sunken)",
                                  color: "var(--color-grey-text-strong)",
                                }}
                              >
                                {opt}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftAccessibility(
                                      draftAccessibility.filter(
                                        (v) => v !== opt,
                                      ),
                                    )
                                  }
                                  style={{
                                    border: "none",
                                    background: "none",
                                    cursor: "pointer",
                                    fontSize: "1.5rem",
                                    lineHeight: 1,
                                    padding: 0,
                                    color: "var(--color-grey-text-strong)",
                                  }}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.2rem",
                        }}
                      >
                        {(displayUser.studentInfo?.accessibilityNeeds ?? [])
                          .length > 0 ? (
                          (
                            displayUser.studentInfo?.accessibilityNeeds ?? []
                          ).map((need) => (
                            <span key={need} className={styles.sectionRowValue}>
                              {need}
                            </span>
                          ))
                        ) : (
                          <span className={styles.sectionRowValue}>-</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Additional Comments field */}
                  <div className={styles.sectionRow}>
                    <span className={styles.sectionRowLabel}>
                      Additional Comments
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
        )}

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
