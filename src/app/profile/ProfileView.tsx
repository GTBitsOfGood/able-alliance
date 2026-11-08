"use client";

import { hasUserType, userTypeLabel } from "@/utils/userTypes";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import BogButton from "@/components/BogButton/BogButton";
import { Shifts } from "./Shifts";
import ConfirmActionModal from "@/components/ConfirmActionModal/ConfirmActionModal";
import { ProfileRidesTab } from "./ProfileRidesTab";
import styles from "./profile.module.css";
import type { UserType } from "@/utils/authUser";
import BogSwitch from "@/components/BogSwitch/BogSwitch";

type ProfileTab = "profile" | "rides" | "shifts" | "settings";

import type { UserResponse } from "@/types/api";

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
  isOwnProfile = false,
  canDelete = false,
}: {
  user: UserResponse;
  canEdit?: boolean;
  viewerType?: UserType;
  isOwnProfile?: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [draftPreferredName, setDraftPreferredName] = useState(
    user.preferredName ?? "",
  );
  const [draftNotes, setDraftNotes] = useState(user.studentInfo?.notes ?? "");
  const [draftAccessibility, setDraftAccessibility] = useState<string[]>(
    user.studentInfo?.accessibilityNeeds.map(
      ({ accommodation }) => accommodation.label,
    ) ?? [],
  );

  const [displayUser, setDisplayUser] = useState(user);
  const [accommodationOptions, setAccommodationOptions] = useState<string[]>(
    [],
  );

  const [notifications, setNotifications] = useState({
    driverAssigned: user.settings?.driverAssigned ?? false,
    driverEnRoute: user.settings?.driverEnRoute ?? false,
    rideCancelled: user.settings?.rideCancelled ?? false,
    rideAssigned: user.settings?.rideAssigned ?? false,
    rideCompleted: user.settings?.rideCompleted ?? false,
    rideDelayed: user.settings?.rideDelayed ?? false,
    newMessageFromDriver: user.settings?.newMessageFromDriver ?? false,
  });

  const [draftNotifications, setDraftNotifications] = useState(notifications);
  const [editingNotifications, setEditingNotifications] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationSaveError, setNotificationSaveError] = useState<
    string | null
  >(null);

  const fetchAccommodations = useCallback(() => {
    if (hasUserType(user, "Student")) {
      fetch("/api/accommodations")
        .then((r) => r.json())
        .then((data: { label: string }[]) =>
          setAccommodationOptions(data.map((d) => d.label)),
        )
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    fetchAccommodations();
  }, [fetchAccommodations]);

  const avatarLetter =
    displayUser.firstName.trim().charAt(0).toUpperCase() || "?";
  const displayName =
    [displayUser.firstName, displayUser.lastName].filter(Boolean).join(" ") ||
    displayUser.email;
  const showAccommodations = hasUserType(displayUser, "Student");

  function handleEdit() {
    setDraftPreferredName(displayUser.preferredName ?? "");
    setDraftNotes(displayUser.studentInfo?.notes ?? "");
    setDraftAccessibility(
      displayUser.studentInfo?.accessibilityNeeds.map(
        ({ accommodation }) => accommodation.label,
      ) ?? [],
    );
    setSaveError(null);
    fetchAccommodations();
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
    setSaveError(null);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/users/${displayUser.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to delete user");
      }
      router.push("/admin/directory/students");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete user");
      setDeleting(false);
      setShowDeleteModal(false);
    }
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
      const updated: UserResponse = await res.json();
      setDisplayUser(updated);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  function handleNotificationToggle(
    key: keyof typeof notifications,
    value: boolean,
  ) {
    setDraftNotifications((prev) => ({ ...prev, [key]: value }));
  }

  function handleEditNotifications() {
    setDraftNotifications(notifications);
    setNotificationSaveError(null);
    setEditingNotifications(true);
  }

  function handleCancelNotifications() {
    setDraftNotifications(notifications);
    setNotificationSaveError(null);
    setEditingNotifications(false);
  }

  async function handleSaveNotifications() {
    setSavingNotifications(true);
    setNotificationSaveError(null);

    try {
      const res = await fetch(`/api/users/${displayUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: draftNotifications,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to update notification settings");
      }

      const updated: UserResponse = await res.json();
      setDisplayUser(updated);
      setNotifications(draftNotifications);
      setEditingNotifications(false);
    } catch (e) {
      setNotificationSaveError(
        e instanceof Error
          ? e.message
          : "Failed to update notification settings",
      );
    } finally {
      setSavingNotifications(false);
    }
  }

  const showSettingsTab =
    canEdit &&
    (hasUserType(displayUser, "Student") || hasUserType(displayUser, "Driver"));
  const showShiftsTab = hasUserType(displayUser, "Driver");
  const showRidesTab =
    (hasUserType(displayUser, "Student") ||
      hasUserType(displayUser, "Driver")) &&
    (viewerType === "Admin" || viewerType === "SuperAdmin");

  return (
    <div className={styles.profilePage}>
      <div className={styles.profileInner}>
        {/* Header */}
        <header className={styles.profileHeader}>
          <div
            className={`${styles.profileAvatar} ${avatarClass(isOwnProfile ? viewerType : displayUser.types[0])}`}
          >
            {avatarLetter}
          </div>
          <div className={styles.profileNameBlock}>
            <h1 className={styles.profileDisplayName}>{displayName}</h1>
            <span className={styles.profileRole}>
              {displayUser.types.map(userTypeLabel).join(" · ")}
            </span>
          </div>
        </header>

        {/* Tabs */}
        <div className={styles.tabBar}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "profile" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            Profile
          </button>
          {showRidesTab && (
            <button
              type="button"
              className={`${styles.tab} ${activeTab === "rides" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("rides")}
            >
              Rides
            </button>
          )}
          {showShiftsTab && (
            <button
              type="button"
              className={`${styles.tab} ${activeTab === "shifts" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("shifts")}
            >
              Shifts
            </button>
          )}
          {showSettingsTab && (
            <button
              type="button"
              className={`${styles.tab} ${activeTab === "settings" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              Settings
            </button>
          )}
        </div>

        {/* Rides tab */}
        {activeTab === "rides" && showRidesTab && (
          <ProfileRidesTab
            userId={displayUser.id}
            userType={
              hasUserType(displayUser, "Student") ? "Student" : "Driver"
            }
          />
        )}

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
                        className={styles.accommodationField}
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
                            <span
                              key={need.accommodation.id}
                              className={styles.sectionRowValue}
                            >
                              {need.accommodation.label}
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

        {activeTab === "settings" && showSettingsTab && (
          <section className={styles.profileCard}>
            <div className={styles.profileCardHeader}>
              <h2 className={styles.sectionTitle}>Notifications</h2>
              {editingNotifications ? (
                <div className={styles.editActions}>
                  <BogButton
                    variant="secondary"
                    size="medium"
                    onClick={handleCancelNotifications}
                    disabled={savingNotifications}
                  >
                    Cancel
                  </BogButton>
                  <BogButton
                    variant="primary"
                    size="medium"
                    onClick={() => void handleSaveNotifications()}
                    disabled={savingNotifications}
                  >
                    {savingNotifications ? "Saving…" : "Save changes"}
                  </BogButton>
                </div>
              ) : (
                <BogButton
                  variant="secondary"
                  size="medium"
                  onClick={handleEditNotifications}
                >
                  Edit notifications
                </BogButton>
              )}
            </div>

            {notificationSaveError && (
              <p className={styles.saveError} role="alert">
                {notificationSaveError}
              </p>
            )}

            <div className={styles.notificationSettings}>
              {hasUserType(displayUser, "Student") && (
                <>
                  <BogSwitch
                    checked={draftNotifications.driverAssigned}
                    onCheckedChange={(value) =>
                      handleNotificationToggle("driverAssigned", value)
                    }
                    disabled={!editingNotifications}
                    label="Ride Confirmed / Driver Assigned"
                  />
                  <BogSwitch
                    checked={draftNotifications.driverEnRoute}
                    onCheckedChange={(value) =>
                      handleNotificationToggle("driverEnRoute", value)
                    }
                    disabled={!editingNotifications}
                    label="Driver is En Route"
                  />
                  <BogSwitch
                    checked={draftNotifications.rideCancelled}
                    onCheckedChange={(value) =>
                      handleNotificationToggle("rideCancelled", value)
                    }
                    disabled={!editingNotifications}
                    label="Ride Cancelled"
                  />
                  <BogSwitch
                    checked={draftNotifications.rideCompleted}
                    onCheckedChange={(value) =>
                      handleNotificationToggle("rideCompleted", value)
                    }
                    disabled={!editingNotifications}
                    label="Ride Completed"
                  />
                  <BogSwitch
                    checked={draftNotifications.newMessageFromDriver}
                    onCheckedChange={(value) =>
                      handleNotificationToggle("newMessageFromDriver", value)
                    }
                    disabled={!editingNotifications}
                    label="New Message from Driver"
                  />
                </>
              )}

              {hasUserType(displayUser, "Driver") && (
                <>
                  <BogSwitch
                    checked={draftNotifications.rideAssigned}
                    onCheckedChange={(value) =>
                      handleNotificationToggle("rideAssigned", value)
                    }
                    disabled={!editingNotifications}
                    label="Ride Assigned"
                  />
                  <BogSwitch
                    checked={draftNotifications.rideCancelled}
                    onCheckedChange={(value) =>
                      handleNotificationToggle("rideCancelled", value)
                    }
                    disabled={!editingNotifications}
                    label="Ride Cancelled"
                  />
                </>
              )}
              {(hasUserType(displayUser, "Student") ||
                hasUserType(displayUser, "Driver")) && (
                <BogSwitch
                  checked={draftNotifications.rideDelayed}
                  onCheckedChange={(value) =>
                    handleNotificationToggle("rideDelayed", value)
                  }
                  disabled={!editingNotifications}
                  label="Ride Delayed"
                />
              )}
            </div>
          </section>
        )}

        {activeTab === "shifts" && showShiftsTab && (
          <Shifts
            user={displayUser}
            canEdit={canEdit}
            viewerType={viewerType}
            onUpdate={setDisplayUser}
          />
        )}

        {isOwnProfile && (
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a href="/api/auth/cas/logout" className={styles.logoutButton}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log out
          </a>
        )}

        {activeTab === "profile" && canDelete && (
          <div className={styles.deleteSection}>
            {deleteError && (
              <p className={styles.saveError} role="alert">
                {deleteError}
              </p>
            )}
            <button
              type="button"
              className={styles.deleteButton}
              onClick={() => setShowDeleteModal(true)}
            >
              Delete user
            </button>
            <ConfirmActionModal
              open={showDeleteModal}
              onOpenChange={(open) => {
                if (!open) setShowDeleteModal(false);
              }}
              onConfirm={() => void handleDelete()}
              variant="destructive"
              title="Delete User?"
              description="Are you sure you want to delete this user? This action cannot be undone."
              confirmLabel="Delete user"
              confirmingLabel="Deleting…"
              cancelLabel="Nevermind"
              confirming={deleting}
            />
          </div>
        )}
      </div>
    </div>
  );
}
