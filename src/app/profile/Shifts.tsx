"use client";

import React, { useState } from "react";
import BogButton from "@/components/BogButton/BogButton";
import { TimeInput } from "@/components/TimeInput/TimeInput";
import styles from "./profile.module.css";

type Shift = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type UserType = "Student" | "Driver" | "Admin" | "SuperAdmin";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatShiftTime(time: string): string {
  // Convert HH:MM to 12-hour format
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function formatShifts(shifts: Shift[]) {
  if (!shifts || shifts.length === 0) return "No shifts scheduled";

  const grouped = shifts.reduce(
    (acc, shift) => {
      const day = shift.dayOfWeek;
      if (!acc[day]) acc[day] = [];
      acc[day].push(
        `${formatShiftTime(shift.startTime)} - ${formatShiftTime(shift.endTime)}`,
      );
      return acc;
    },
    {} as Record<number, string[]>,
  );
  for (let day = 0; day < DAY_NAMES.length; day++) {
    if (!grouped[day]) {
      grouped[day] = [];
    }
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([day, times], index) => (
      <div key={index} className={styles.shiftRow}>
        <div
          className={styles.shiftColumnLeft}
        >{`${DAY_NAMES[Number(day)]}`}</div>
        <div className={styles.shiftColumnRight}>
          {times.length == 0
            ? "None"
            : times.map((time, index2) => (
                <div key={index2} className={styles.shiftBubble}>
                  {time}
                </div>
              ))}
        </div>
      </div>
    ));
}

function ShiftEditor({
  shifts,
  onChange,
}: {
  shifts: Shift[];
  onChange: (shifts: Shift[]) => void;
}) {
  const addShift = (dayOfWeek: number) => {
    const newShift: Shift = {
      dayOfWeek,
      startTime: "09:00",
      endTime: "17:00",
    };
    onChange([...shifts, newShift]);
  };

  const removeShift = (index: number) => {
    const newShifts = shifts.filter((_, i) => i !== index);
    onChange(newShifts);
  };

  const updateShift = (
    index: number,
    field: keyof Shift,
    value: string | number,
  ) => {
    const newShifts = shifts.map((shift, i) =>
      i === index ? { ...shift, [field]: value } : shift,
    );
    onChange(newShifts);
  };

  const shiftsByDay = shifts.reduce(
    (acc, shift, index) => {
      if (!acc[shift.dayOfWeek]) acc[shift.dayOfWeek] = [];
      acc[shift.dayOfWeek].push({ ...shift, originalIndex: index });
      return acc;
    },
    {} as Record<number, (Shift & { originalIndex: number })[]>,
  );

  return (
    <div className={styles.shiftEditor}>
      {DAY_NAMES.map((dayName, dayOfWeek) => (
        <div key={dayOfWeek} className={styles.shiftDay}>
          <div className={styles.shiftDayHeader}>
            <span className={styles.shiftDayName}>{dayName}</span>
            <BogButton
              variant="primary"
              size="small"
              onClick={() => addShift(dayOfWeek)}
            >
              Add shift
            </BogButton>
          </div>
          <div className={styles.shiftList}>
            {(shiftsByDay[dayOfWeek] || []).map((shift) => (
              <div key={shift.originalIndex} className={styles.shiftItem}>
                <TimeInput
                  value={shift.startTime}
                  onChange={(v) =>
                    updateShift(shift.originalIndex, "startTime", v)
                  }
                  inputClassName={styles.shiftTimeInput}
                  className={styles.shiftTimeInputWrapper}
                />
                <span className={styles.shiftTimeSeparator}>to</span>
                <TimeInput
                  value={shift.endTime}
                  onChange={(v) =>
                    updateShift(shift.originalIndex, "endTime", v)
                  }
                  inputClassName={styles.shiftTimeInput}
                  className={styles.shiftTimeInputWrapper}
                />
                <BogButton
                  variant="secondary"
                  size="small"
                  onClick={() => removeShift(shift.originalIndex)}
                >
                  Remove
                </BogButton>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Shifts({
  user,
  canEdit,
  viewerType,
  onUpdate,
}: {
  user: { id: string; type: UserType; shifts?: Shift[] };
  canEdit: boolean;
  viewerType: UserType;
  onUpdate: (shifts: Shift[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftShifts, setDraftShifts] = useState(user.shifts ?? []);

  const handleEdit = () => {
    setDraftShifts(user.shifts ?? []);
    setSaveError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shifts: draftShifts }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to save changes");
      }
      onUpdate(draftShifts);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // Only show for drivers
  if (user.type !== "Driver") {
    return null;
  }

  // Only admins can edit shifts
  const canEditShifts =
    canEdit && (viewerType === "Admin" || viewerType === "SuperAdmin");

  return (
    <section className={styles.shiftCard}>
      <div className={styles.profileCardHeader}>
        <h2 className={styles.sectionTitle}>Driver Shifts</h2>
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
          canEditShifts && (
            <BogButton variant="secondary" size="medium" onClick={handleEdit}>
              Edit shifts
            </BogButton>
          )
        )}
      </div>

      {saveError && (
        <p className={styles.saveError} role="alert">
          {saveError}
        </p>
      )}

      <div className={styles.sectionBody}>
        {editing ? (
          <ShiftEditor shifts={draftShifts} onChange={setDraftShifts} />
        ) : (
          <div className={styles.sectionRow}>
            <span className={styles.sectionRowValue}>
              {formatShifts(user.shifts || [])}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
