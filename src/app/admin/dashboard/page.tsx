"use client";

import { CalendarBlankIcon, WarningCircleIcon } from "@phosphor-icons/react";

import PickupDemandHeatmap from "@/components/admin/PickupDemandHeatmap";

import DashboardChart from "@/components/admin/DashboardChart";
import DashboardMetrics from "@/components/admin/DashboardMetrics";
import DashboardReportState from "@/components/admin/DashboardReportState";
import { useStatistics } from "@/hooks/useStatistics";
import styles from "@/components/admin/dashboard.module.css";

const number = new Intl.NumberFormat("en-US");
const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

export default function DashboardPage() {
  const { period, stats, changes, ...status } = useStatistics();
  const hasRides = stats.total > 0;
  const outcomes = Object.entries(stats.outcomes).map(([label, count]) => ({
    label,
    count,
  }));
  const completion =
    stats.completionRate === null ? null : percent.format(stats.completionRate);
  const metrics = [
    {
      label: "Total rides",
      value: stats.total,
      info: "Includes all ride statuses",
      change: changes?.total,
      Icon: CalendarBlankIcon,
    },
    {
      label: "Needs admin attention",
      value: stats.needsAttention,
      info: "Requests and changes to review",
      Icon: WarningCircleIcon,
    },
  ];

  return (
    <DashboardReportState {...status}>
      <DashboardMetrics metrics={metrics} compact />

      {hasRides ? (
        <div className={styles.panels}>
          <section className={styles.panel} aria-labelledby="ride-volume">
            <div className={styles.panelHeader}>
              <h2 id="ride-volume" className="text-heading-3">
                {period === "yearly" ? "Rides by Month" : "Rides by Day"}
              </h2>
            </div>
            <DashboardChart points={stats.volume} variant="volume" />
          </section>

          <section className={styles.panel} aria-labelledby="ride-outcomes">
            <div className={styles.panelHeader}>
              <h2 id="ride-outcomes" className="text-heading-3">
                Ride Outcomes
              </h2>
            </div>
            <DashboardChart
              points={outcomes}
              variant="outcomes"
              valueLabel={completion}
            />
            <dl className={styles.outcomes}>
              {outcomes.map(({ label, count }) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{number.format(count)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <PickupDemandHeatmap
            intervals={stats.pickupTimes}
            counts={stats.weekdayDemand}
          />

          <section
            className={`${styles.panel} ${styles.fullWidthPanel}`}
            aria-labelledby="pickup-hours"
          >
            <div className={styles.panelHeader}>
              <h2 id="pickup-hours" className="text-heading-3">
                Pickup Demand
              </h2>
              <p>15-minute intervals</p>
            </div>
            <DashboardChart points={stats.pickupTimes} variant="distribution" />
          </section>
        </div>
      ) : (
        <section className={`${styles.panel} ${styles.empty}`}>
          <CalendarBlankIcon size={28} aria-hidden="true" />
          <h2 className="text-heading-3">No rides in this period</h2>
        </section>
      )}
    </DashboardReportState>
  );
}
