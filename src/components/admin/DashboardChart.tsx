"use client";

import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useRef, type MouseEvent } from "react";

import {
  formatMinutes,
  SERVICE_END_MINUTES,
  SERVICE_START_MINUTES,
} from "@/utils/rideTiming";

import styles from "./dashboard.module.css";

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

const outcomeColors = ["completed", "cancelled", "missing", "open"] as const;

interface ChartPoint {
  label: string;
  fullLabel?: string;
  count: number;
}

type DashboardChartProps =
  | { variant: "volume"; points: ChartPoint[] }
  | { variant: "distribution"; points: ChartPoint[] }
  | { variant: "outcomes"; points: ChartPoint[]; valueLabel: string | null }
  | {
      variant: "hours";
      points: (ChartPoint & { minuteOfDay: number })[];
      measure?: string;
    }
  | {
      variant: "ranking";
      points: { id: string; label: string; counts: number[] }[];
      series: readonly string[];
      seriesColors: readonly string[];
      selectedId?: string;
      onSelect?: (id: string) => void;
      interactive?: boolean;
      labelTooltips?: boolean;
    };

export default function DashboardChart(props: DashboardChartProps) {
  const { points, variant } = props;
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const css = getComputedStyle(canvas);
    const color = (name: string) => css.getPropertyValue(name).trim();
    const options = {
      animation: false as const,
      maintainAspectRatio: false,
      color: color("--chart-text"),
    };
    const y = {
      beginAtZero: true,
      grid: { color: color("--chart-grid") },
      ticks: { precision: 0 },
    };

    if (variant === "ranking") {
      const chart = new Chart(canvas, {
        type: "bar",
        data: {
          labels: points.map(({ label }) => label),
          datasets: props.series.map((label, index) => ({
            label,
            data: points.map(({ counts }) => counts[index]),
            backgroundColor: color(props.seriesColors[index]),
            hoverBorderColor: color("--chart-text"),
            hoverBorderWidth: props.interactive === false ? 0 : 2,
            ...(props.interactive === false && {
              hoverBackgroundColor: color(props.seriesColors[index]),
            }),
            borderRadius: 4,
            maxBarThickness: 24,
          })),
        },
        options: {
          ...options,
          indexAxis: "y",
          ...(props.interactive === false && {
            events: props.labelTooltips
              ? (
                  ["mousemove", "mouseout", "touchstart", "touchmove"] as const
                ).slice()
              : [],
          }),
          plugins: {
            tooltip: {
              callbacks: {
                title: ([item]) => points[item.dataIndex]?.label ?? "",
              },
            },
          },
          interaction: { axis: "y", mode: "index", intersect: false },
          scales: {
            x: { ...y, stacked: true, suggestedMax: 1 },
            y: {
              stacked: true,
              grid: { display: false },
              ticks: {
                autoSkip: false,
                color: (context) =>
                  points[context.tick.value]?.id === props.selectedId
                    ? color("--chart-ranking-primary")
                    : options.color,
                font: (context) => ({
                  weight:
                    points[context.tick.value]?.id === props.selectedId
                      ? "bold"
                      : "normal",
                }),
                callback(value) {
                  const label = this.getLabelForValue(Number(value));
                  return label.length > 22 ? `${label.slice(0, 21)}…` : label;
                },
              },
            },
          },
        },
      });
      return () => chart.destroy();
    }

    if (variant === "distribution") {
      const peak = Math.max(0, ...points.map(({ count }) => count));
      const chart = new Chart(canvas, {
        type: "bar",
        data: {
          labels: points.map(({ label }) => label),
          datasets: [
            {
              label: "Rides",
              data: points.map(({ count }) => count),
              backgroundColor: points.map(({ count }) =>
                color(
                  count > 0 && count === peak
                    ? "--chart-hours"
                    : "--chart-volume",
                ),
              ),
              borderRadius: 4,
              barPercentage: 0.85,
              categoryPercentage: 1,
            },
          ],
        },
        options: {
          ...options,
          interaction: { mode: "index", intersect: false },
          plugins: {
            tooltip: {
              callbacks: {
                title: ([item]) =>
                  points[item.dataIndex].fullLabel ?? item.label,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { maxRotation: 0, autoSkip: true },
            },
            y: {
              ...y,
              suggestedMax: 1,
              title: { display: true, text: "Rides" },
            },
          },
        },
      });
      return () => chart.destroy();
    }

    if (variant === "hours") {
      const chart = new Chart(canvas, {
        type: "line",
        data: {
          datasets: [
            {
              label: props.measure ?? "Rides",
              data: points.map(({ minuteOfDay, count }) => ({
                x: minuteOfDay,
                y: count,
              })),
              borderColor: color("--chart-hours"),
              backgroundColor: color("--chart-hours"),
              cubicInterpolationMode: "monotone",
              pointRadius: 2,
              pointHoverRadius: 5,
            },
          ],
        },
        options: {
          ...options,
          interaction: { axis: "x", intersect: false },
          plugins: {
            tooltip: {
              callbacks: { title: ([item]) => points[item.dataIndex].label },
            },
          },
          scales: {
            x: {
              type: "linear",
              min: SERVICE_START_MINUTES,
              max: SERVICE_END_MINUTES,
              grid: { display: false },
              ticks: {
                stepSize: 60,
                maxRotation: 0,
                maxTicksLimit: 7,
                callback: (value) => formatMinutes(Number(value)),
              },
            },
            y,
          },
        },
      });

      return () => chart.destroy();
    }

    const labels = points.map(({ label }) => label);
    const data = points.map(({ count }) => count);
    const chart =
      variant === "outcomes"
        ? new Chart(canvas, {
            type: "doughnut",
            data: {
              labels,
              datasets: [
                {
                  data,
                  backgroundColor: outcomeColors.map((name) =>
                    color(`--chart-${name}`),
                  ),
                  borderColor: color("--chart-surface"),
                  borderWidth: 2,
                },
              ],
            },
            options: { ...options, cutout: "73%" },
          })
        : new Chart(canvas, {
            type: "bar",
            data: {
              labels,
              datasets: [
                {
                  label: "Rides",
                  data,
                  backgroundColor: color("--chart-volume"),
                  hoverBackgroundColor: color("--chart-hours"),
                  borderRadius: 4,
                  maxBarThickness: 44,
                },
              ],
            },
            options: {
              ...options,
              interaction: { mode: "index", intersect: false },
              plugins: {
                tooltip: {
                  callbacks: {
                    title: ([item]) =>
                      points[item.dataIndex].fullLabel ?? item.label,
                  },
                },
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { maxRotation: 0 },
                },
                y,
              },
            },
          });

    return () => chart.destroy();
  }, [points, variant, props]);

  function selectRankingRow(event: MouseEvent<HTMLCanvasElement>) {
    if (props.variant !== "ranking" || props.interactive === false) return;
    const chart = Chart.getChart(event.currentTarget);
    if (!chart) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const y = ((event.clientY - rect.top) / rect.height) * chart.height;
    if (y < chart.chartArea.top || y > chart.chartArea.bottom) return;
    const index = chart.scales.y.getValueForPixel(y);
    if (index === undefined) return;
    const point = props.points[index];
    if (point) props.onSelect?.(point.id);
  }

  return (
    <div
      className={
        variant === "outcomes"
          ? styles.donut
          : variant === "ranking"
            ? styles.rankingChart
            : styles.chart
      }
      style={
        variant === "ranking"
          ? { height: `${Math.max(12, points.length * 3.4 + 4)}rem` }
          : undefined
      }
    >
      <canvas
        ref={ref}
        data-interactive={
          (variant === "ranking" && props.interactive !== false) || undefined
        }
        onClick={
          variant === "ranking" && props.interactive !== false
            ? selectRankingRow
            : undefined
        }
        role="img"
        aria-hidden={variant === "outcomes" || undefined}
        aria-label={
          variant === "hours"
            ? props.measure
              ? `${props.measure} by pickup hour`
              : "Ride pickups by scheduled time"
            : variant === "distribution"
              ? "Pickup distribution in 15-minute intervals. Darker bars mark the busiest intervals."
              : variant === "volume"
                ? "Ride volume over the selected period"
                : variant === "ranking"
                  ? points
                      .map(
                        ({ label, counts }) =>
                          `${label}, ${props.series.map((series, index) => `${counts[index]} ${series.toLowerCase()}`).join(", ")}`,
                      )
                      .join(". ")
                  : undefined
        }
      />
      {variant === "outcomes" && (
        <div className={styles.donutCenter}>
          {props.valueLabel ? (
            <>
              <strong>{props.valueLabel}</strong>
              <span>of closed rides completed</span>
            </>
          ) : (
            <span>No closed rides</span>
          )}
        </div>
      )}
    </div>
  );
}
