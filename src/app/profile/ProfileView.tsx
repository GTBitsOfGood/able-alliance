"use client";

import React from "react";
import BogButton from "@/components/BogButton/BogButton";
import styles from "./profile.module.css";

type UserType = "Student" | "Driver" | "Admin" | "SuperAdmin";

export type ProfileUser = {
  id: string;
  name: string;
  email: string;
  type: UserType;
  studentInfo?: {
    notes?: string | null;
    accessibilityNeeds?: "Wheelchair" | "LowMobility" | null;
  } | null;
};

function splitName(name: string): { first: string; last: string } {
  const trimmed = name.trim();
  if (!trimmed) return { first: "-", last: "-" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0], last: "-" };
  }
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

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

export function ProfileView({ user }: { user: ProfileUser }) {
  const { first, last } = splitName(user.name);
  const preferredFirst = "-";
  const avatarLetter = user.name.trim().charAt(0).toUpperCase() || "?";
  const showAccommodations = user.type === "Student";

  return (
    <div className={styles.profilePage}>
      <div className={styles.profileInner}>
        <header className={styles.profileHeader}>
          <div className={`${styles.profileAvatar} ${avatarClass(user.type)}`}>
            {avatarLetter}
          </div>
          <div className={styles.profileNameBlock}>
            <h1 className={styles.profileDisplayName}>{user.name}</h1>
            <span className={styles.profileRole}>{roleLabel(user.type)}</span>
          </div>
        </header>

        <section className={styles.profileCard}>
          <div className={styles.profileCardHeader}>
            <h2 className={styles.sectionTitle}>Personal Information</h2>
            <BogButton variant="secondary" size="medium">
              Edit information
            </BogButton>
          </div>

          <div className={styles.profileFieldGrid}>
            <div className={styles.profileField}>
              <span className={styles.fieldLabel}>First name</span>
              <span className={styles.fieldValue}>{first}</span>
            </div>
            <div className={styles.profileField}>
              <span className={styles.fieldLabel}>Last name</span>
              <span className={styles.fieldValue}>{last}</span>
            </div>
            <div className={styles.profileField}>
              <span className={styles.fieldLabel}>Preferred first name</span>
              <span className={styles.fieldValue}>{preferredFirst}</span>
            </div>
            <div className={styles.profileField}>
              <span className={styles.fieldLabel}>Email</span>
              <span className={styles.fieldValue}>{user.email}</span>
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
                  <span className={styles.sectionRowValue}>
                    {accessibilityLabel(
                      user.studentInfo?.accessibilityNeeds ?? null,
                    )}
                  </span>
                </div>
                <div className={styles.sectionRow}>
                  <span className={styles.sectionRowLabel}>
                    Additional comments
                  </span>
                  <span className={styles.sectionRowValue}>
                    {user.studentInfo?.notes?.trim() || "-"}
                  </span>
                </div>
              </div>
            </section>
          )}
        </section>
      </div>
    </div>
  );
}
