"use client";

import { addDays, format, startOfWeek } from "date-fns";

import DatePicker from "@/components/DatePicker/DatePicker";
import BogIcon from "@/components/BogIcon/BogIcon";
import { estDateKey, parseCalendarDate } from "@/utils/dateEst";
import type { RouteEntry } from "@/types/admin";

import styles from "./schedule.module.css";

interface ScheduleDateNavigationProps {
  date: string;
  routes: RouteEntry[];
  busy: boolean;
  isAdmin: boolean;
  changeDate: (date: string) => void;
}

export default function ScheduleDateNavigation({
  date,
  routes,
  busy,
  isAdmin,
  changeDate,
}: ScheduleDateNavigationProps) {
  const weekStart = startOfWeek(parseCalendarDate(date), { weekStartsOn: 1 });
  const week = Array.from({ length: 5 }, (_, index) =>
    addDays(weekStart, index),
  );

  return (
    <>
      <header className={styles.header}>
        <h1 className="text-heading-1">Schedule</h1>
        <DatePicker
          appearance="date"
          ready={isAdmin}
          disabled={busy}
          selectedDate={date}
          onDateChange={changeDate}
          allowPastWeeks
        />
      </header>

      <nav className={styles.weekNav} aria-label="Schedule days">
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Previous week"
          disabled={busy}
          onClick={() =>
            changeDate(
              format(addDays(parseCalendarDate(date), -7), "yyyy-MM-dd"),
            )
          }
        >
          <BogIcon name="chevron-left" size={20} />
        </button>
        <div className={styles.weekDays}>
          {week.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const remaining = routes.filter(
              (r) =>
                r.status === "Requested" &&
                r.scheduledPickupTime &&
                estDateKey(new Date(r.scheduledPickupTime)) === key,
            ).length;

            return (
              <button
                key={key}
                className={`${styles.day} ${date === key ? styles.selectedDay : ""}`}
                aria-current={date === key ? "date" : undefined}
                disabled={busy}
                onClick={() => changeDate(key)}
              >
                <span>{format(day, "EEE, MMM d")}</span>
                <small>
                  {remaining ? `${remaining} left` : "No pending requests"}
                </small>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Next week"
          disabled={busy}
          onClick={() =>
            changeDate(
              format(addDays(parseCalendarDate(date), 7), "yyyy-MM-dd"),
            )
          }
        >
          <BogIcon name="chevron-right" size={20} />
        </button>
      </nav>
    </>
  );
}
