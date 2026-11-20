"use client";

import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { format } from "date-fns";
import {
  CarIcon,
  MapPinIcon,
  SquaresFourIcon,
  SteeringWheelIcon,
  UsersIcon,
} from "@phosphor-icons/react";

import DatePicker from "@/components/DatePicker/DatePicker";
import {
  dashboardSections,
  reportingPeriods,
  useReportingRange,
  type DashboardSection,
  type ReportingPeriod,
} from "@/hooks/useStatistics";
import { estDateKey, parseCalendarDate } from "@/utils/dateEst";

import styles from "./dashboard.module.css";

const sectionIcons = {
  overview: SquaresFourIcon,
  students: UsersIcon,
  drivers: SteeringWheelIcon,
  vehicles: CarIcon,
  locations: MapPinIcon,
};

function reportHref(section: string, period: ReportingPeriod, date?: string) {
  return {
    pathname:
      section === "overview"
        ? "/admin/dashboard"
        : `/admin/dashboard/${section}`,
    query: { view: period, ...(date && { date }) },
  };
}

export default function DashboardNavigation() {
  const router = useRouter();
  const section = useSelectedLayoutSegment() ?? "overview";
  const { period, anchor, first } = useReportingRange();
  const today = parseCalendarDate(estDateKey(new Date()));
  const mode =
    period === "weekly" ? "week" : period === "monthly" ? "month" : "year";
  function selectDate(date: string) {
    const path =
      section === "overview"
        ? "/admin/dashboard"
        : `/admin/dashboard/${section}`;
    const query = new URLSearchParams({
      view: period,
      date,
    });
    router.push(`${path}?${query.toString()}`, { scroll: false });
  }

  return (
    <>
      <section className={styles.reporting} aria-label="Reporting period">
        <nav className={styles.periods} aria-label="Report view">
          {Object.entries(reportingPeriods).map(([key, { label }]) => (
            <Link
              key={key}
              href={reportHref(section, key as ReportingPeriod, anchor)}
              aria-current={key === period ? "true" : undefined}
              prefetch={false}
              scroll={false}
            >
              {label}
            </Link>
          ))}
        </nav>

        <DatePicker
          mode={mode}
          selectedDate={format(first, "yyyy-MM-dd")}
          onDateChange={selectDate}
          ready
          allowPastWeeks
          compact
          shortcutDirection="previous"
          maxDate={today}
        />
      </section>

      <nav className={styles.sections} aria-label="Dashboard views">
        {(Object.keys(dashboardSections) as DashboardSection[]).map((key) => {
          const Icon = sectionIcons[key];
          return (
            <Link
              key={key}
              href={reportHref(key, period, anchor)}
              aria-current={key === section ? "page" : undefined}
              prefetch={false}
              scroll={false}
            >
              <span className={styles.sectionIcon}>
                <Icon size={20} aria-hidden="true" />
              </span>
              {dashboardSections[key]}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
