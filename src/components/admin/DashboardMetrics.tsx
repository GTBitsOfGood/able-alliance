import { InfoIcon, type Icon } from "@phosphor-icons/react";

import styles from "./dashboard.module.css";

interface DashboardMetric {
  label: string;
  value: number;
  total?: number;
  info?: string;
  description?: string;
  change?: {
    value: number | null;
    description: string;
    increaseIsGood: boolean;
  };
  Icon: Icon;
}

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export default function DashboardMetrics({
  metrics,
  compact = false,
}: {
  metrics: DashboardMetric[];
  compact?: boolean;
}) {
  return (
    <dl className={`${styles.metrics} ${compact ? styles.compactMetrics : ""}`}>
      {metrics.map(
        ({ label, value, total, info, description, change, Icon }) => (
          <div key={label} className={styles.metric}>
            <Icon size={20} className={styles.metricIcon} aria-hidden="true" />
            <dt>
              <span className={styles.metricLabel}>
                {label}
                {info && (
                  <span
                    className={styles.metricInfo}
                    tabIndex={0}
                    aria-label={info}
                  >
                    <InfoIcon size={16} aria-hidden="true" />
                    <span role="tooltip">{info}</span>
                  </span>
                )}
              </span>
              {description && (
                <span className={styles.metricDescription}>{description}</span>
              )}
            </dt>
            <dd>
              {number.format(value)}
              {change && (
                <span
                  className={`${styles.metricInfo} ${styles.metricTrend}`}
                  data-tone={
                    change.value === 0
                      ? "neutral"
                      : change.value === null || change.value > 0
                        ? change.increaseIsGood
                          ? "positive"
                          : "negative"
                        : change.increaseIsGood
                          ? "negative"
                          : "positive"
                  }
                  tabIndex={0}
                  aria-label={`${change.value === null ? "New" : percent.format(change.value)}. ${change.description}`}
                >
                  {change.value === null ? "New" : percent.format(change.value)}
                  <span role="tooltip">{change.description}</span>
                </span>
              )}
              {total !== undefined && (
                <small className={styles.metricTotal}>
                  {" "}
                  / {number.format(total)}
                </small>
              )}
            </dd>
          </div>
        ),
      )}
    </dl>
  );
}
