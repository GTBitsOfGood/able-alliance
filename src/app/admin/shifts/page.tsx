"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import BogTable, {
  type ColumnHeaderCellContent,
  type TableRow,
} from "@/components/BogTable/BogTable";
import styles from "./styles.module.css";

type ShiftInstance = {
  driverId: string;
  driverName: string;
  date: string;
  dateLabel: string;
  dayName: string;
  startTime: string;
  endTime: string;
  startTime24: string;
  endTime24: string;
};

const WEEK_OPTIONS = [
  { label: "All", value: "all" },
  { label: "This week", value: "this" },
  { label: "Next week", value: "next" },
] as const;

const DAY_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
] as const;

const COLUMNS: ColumnHeaderCellContent[] = [
  { content: "Name", datatype: "string" },
  { content: "Date", datatype: "string" },
  { content: "Day", datatype: "string" },
  { content: "Start Time", datatype: "string" },
  { content: "End Time", datatype: "string" },
];

export default function ShiftsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [week, setWeek] = useState<"all" | "this" | "next">("all");
  const [day, setDay] = useState<string>("all");
  const [shifts, setShifts] = useState<ShiftInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  const userType = session?.user?.type;
  useEffect(() => {
    if (
      sessionStatus !== "loading" &&
      userType !== "Admin" &&
      userType !== "SuperAdmin"
    ) {
      router.replace("/");
    }
  }, [sessionStatus, userType, router]);

  // Fetch shifts
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (userType !== "Admin" && userType !== "SuperAdmin") return;

    const fetchShifts = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ week, day });
        const r = await fetch(`/api/shifts?${params}`);
        if (!r.ok) throw new Error("Failed to fetch shifts");
        const data: ShiftInstance[] = await r.json();
        setShifts(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch shifts");
      } finally {
        setLoading(false);
      }
    };

    void fetchShifts();
  }, [week, day, sessionStatus, userType]);

  const rows: TableRow[] = shifts.map((s) => ({
    cells: [
      { content: s.driverName },
      { content: s.dateLabel },
      { content: s.dayName },
      { content: s.startTime },
      { content: s.endTime },
    ],
  }));

  const handleRowClick = (idx: number) => {
    const shift = shifts[idx];
    if (!shift) return;
    router.push(`/admin/shifts/${shift.driverId}?date=${shift.date}`);
  };

  if (
    sessionStatus === "loading" ||
    (userType !== "Admin" && userType !== "SuperAdmin")
  ) {
    return null;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Shifts</h1>

      {/* Week filter */}
      <div className={styles.filterRow}>
        {WEEK_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.pill} ${week === opt.value ? styles.pillActive : ""}`}
            onClick={() => setWeek(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Day filter */}
      <div className={styles.filterRow}>
        {DAY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.pill} ${day === opt.value ? styles.pillActive : ""}`}
            onClick={() => setDay(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table (BogTable provides its own search bar) */}
      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : (
        <div className={styles.tableWrap}>
          <BogTable
            columnHeaders={COLUMNS}
            rows={rows}
            onRowClick={handleRowClick}
          />
        </div>
      )}
    </div>
  );
}
