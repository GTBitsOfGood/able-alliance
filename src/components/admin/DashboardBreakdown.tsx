"use client";

import { useState, type CSSProperties } from "react";
import {
  CarIcon,
  ChartBarIcon,
  MapPinIcon,
  SteeringWheelIcon,
  UsersIcon,
} from "@phosphor-icons/react";

import {
  useDashboardBreakdown,
  dashboardRideStatuses,
  type DashboardBreakdown as Breakdown,
  type DashboardDetailSection,
} from "@/hooks/useStatistics";

import BogCheckbox from "@/components/BogCheckbox/BogCheckbox";

import DashboardChart from "./DashboardChart";
import DashboardMetrics from "./DashboardMetrics";
import DashboardReportState from "./DashboardReportState";
import LocationsMap from "./LocationsMap";
import styles from "./dashboard.module.css";

const activityLabels = {
  students: { name: "Student", plural: "students", Icon: UsersIcon },
  drivers: { name: "Driver", plural: "drivers", Icon: SteeringWheelIcon },
  vehicles: { name: "Vehicle", plural: "vehicles", Icon: CarIcon },
};

function breakdownContent(breakdown: Breakdown) {
  if (breakdown.section === "locations") {
    const { rows } = breakdown;
    const active = rows.filter(({ total }) => total > 0).length;
    const stops = rows.reduce((sum, { total }) => sum + total, 0);

    return {
      Icon: MapPinIcon,
      plural: "locations",
      title: "Stops by Location",
      metrics: [
        {
          label: "Locations with rides",
          value: active,
          total: rows.length,
          Icon: MapPinIcon,
        },
        {
          label: "Average rides per location",
          value: active ? stops / active : 0,
          info: "Counts pickups and drop-offs across locations with at least one ride in this period. Excludes locations with zero rides.",
          Icon: ChartBarIcon,
        },
      ],
      series: ["Pickups", "Drop-offs"] as const,
      seriesColors: ["--chart-ranking-primary", "--chart-ranking-secondary"],
      chart: rows.map(({ id, name, pickups, dropoffs }) => ({
        id,
        label: name,
        counts: [pickups, dropoffs],
      })),
    };
  }

  const { rows, total } = breakdown;
  const { name, plural, Icon } = activityLabels[breakdown.section];
  const active = rows.filter(({ total }) => total > 0).length;
  return {
    Icon,
    plural,
    title: `Rides by ${name}`,
    metrics: [
      {
        label: `${name}s with rides`,
        value: active,
        total: rows.length,
        Icon,
      },
      {
        label: `Average rides per ${name.toLowerCase()}`,
        value: active ? total / active : 0,
        info: `Average across ${plural} with at least one ride in this period. Excludes ${plural} with zero rides.`,
        Icon: ChartBarIcon,
      },
    ],
    series:
      breakdown.section === "vehicles"
        ? ["Rides"]
        : dashboardRideStatuses.map(({ label }) => label),
    seriesColors:
      breakdown.section === "vehicles"
        ? ["--chart-ranking-primary"]
        : dashboardRideStatuses.map(({ color }) => color),
    chart: rows.map(({ id, name, total, statuses }) => ({
      id,
      label: name,
      counts:
        breakdown.section === "vehicles"
          ? [total]
          : dashboardRideStatuses.map(({ statuses: group }) =>
              group.reduce((total, status) => total + statuses[status], 0),
            ),
    })),
  };
}

export default function DashboardBreakdown({
  section,
}: {
  section: DashboardDetailSection;
}) {
  const { breakdown, ...status } = useDashboardBreakdown(section);
  const [hideEmptyLocations, setHideEmptyLocations] = useState(false);
  const locationRows =
    breakdown.section === "locations"
      ? breakdown.rows.filter(({ total }) => !hideEmptyLocations || total > 0)
      : [];
  const { Icon, plural, title, metrics, series, seriesColors, chart } =
    breakdownContent(breakdown);

  return (
    <DashboardReportState {...status}>
      {metrics && <DashboardMetrics metrics={metrics} compact />}
      {section === "locations" && (
        <div
          className={styles.locationSettings}
          role="group"
          aria-label="Location settings"
        >
          <strong>Settings</strong>
          <div className={styles.locationFilter}>
            <BogCheckbox
              id="hide-empty-locations"
              name="hide-empty-locations"
              checked={hideEmptyLocations}
              onCheckedChange={(checked) =>
                setHideEmptyLocations(checked === true)
              }
              aria-label="Hide locations with no rides"
            />
            <label htmlFor="hide-empty-locations">
              Hide locations with no rides
            </label>
          </div>
        </div>
      )}

      {breakdown.rows.length > 0 ? (
        <div className={styles.detailPanels}>
          <section className={styles.panel} aria-labelledby="dashboard-ranking">
            <div className={styles.breakdownHeader}>
              <div className={styles.panelHeader}>
                <h2 id="dashboard-ranking" className="text-heading-3">
                  {title}
                </h2>
              </div>
              {series.length > 1 && (
                <ul className={styles.rankingLegend} aria-label="Chart legend">
                  {series.map((label, index) => (
                    <li
                      key={label}
                      style={
                        {
                          "--swatch": `var(${seriesColors[index]})`,
                        } as CSSProperties
                      }
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div
              className={styles.rankingViewport}
              role="region"
              aria-label={title}
              tabIndex={0}
            >
              {section === "locations" && locationRows.length === 0 ? (
                <p className={styles.chartNote}>
                  No locations with rides in this period.
                </p>
              ) : (
                <DashboardChart
                  variant="ranking"
                  points={
                    section === "locations" && hideEmptyLocations
                      ? chart.filter(({ counts }) =>
                          counts.some((count) => count > 0),
                        )
                      : chart
                  }
                  series={series}
                  seriesColors={seriesColors}
                  interactive={false}
                  labelTooltips
                />
              )}
            </div>
          </section>

          {breakdown.section === "locations" && (
            <section
              className={styles.panel}
              aria-labelledby="location-activity-map"
            >
              <div className={styles.panelHeader}>
                <h2 id="location-activity-map" className="text-heading-3">
                  Location Activity
                </h2>
                <p>Dot size shows pickups and drop-offs.</p>
              </div>
              <LocationsMap
                locations={locationRows.flatMap((location) =>
                  typeof location.latitude === "number" &&
                  Number.isFinite(location.latitude) &&
                  typeof location.longitude === "number" &&
                  Number.isFinite(location.longitude)
                    ? [
                        {
                          ...location,
                          latitude: location.latitude,
                          longitude: location.longitude,
                        },
                      ]
                    : [],
                )}
                scaleByActivity
              />
            </section>
          )}

          {breakdown.section === "locations" && (
            <section className={styles.panel} aria-labelledby="location-pairs">
              <div className={styles.panelHeader}>
                <h2 id="location-pairs" className="text-heading-3">
                  Most Common Trips
                </h2>
              </div>
              {breakdown.pairs.length === 0 ? (
                <p className={styles.chartNote}>No trips in this period.</p>
              ) : (
                <ol className={styles.tripPairs}>
                  {breakdown.pairs
                    .slice(0, 5)
                    .map(({ id, pickup, dropoff, count }, index) => (
                      <li key={id}>
                        <span className={styles.tripRank} aria-hidden="true">
                          {index + 1}
                        </span>
                        <span className={styles.tripRoute}>
                          <span>{pickup}</span>
                          <span aria-label="to">→</span>
                          <span>{dropoff}</span>
                        </span>
                        <strong>
                          {count.toLocaleString()}{" "}
                          <span>{count === 1 ? "ride" : "rides"}</span>
                        </strong>
                      </li>
                    ))}
                </ol>
              )}
            </section>
          )}
        </div>
      ) : (
        <section className={`${styles.panel} ${styles.empty}`}>
          <Icon size={28} aria-hidden="true" />
          <h2 className="text-heading-3">No {plural} to show</h2>
        </section>
      )}
    </DashboardReportState>
  );
}
