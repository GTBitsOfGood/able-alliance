"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-toast";

import { useAdminRides } from "@/hooks/useAdminRides";
import { useRouteUpdates } from "@/hooks/useRouteUpdates";
import { estDateKey } from "@/utils/dateEst";
import { isServiceDate, nextServiceDate } from "@/utils/rideTiming";
import { buildScheduleRides } from "@/utils/adminSchedule";
import type {
  AutoSchedulePlan,
  ScheduleAssignment,
} from "@/types/autoSchedule";

async function readJson(response: Response) {
  return response
    .json()
    .catch(() => ({ error: `Server responded ${response.status}` }));
}

type PendingScheduleAction =
  { type: "changeDate"; date: string } | { type: "regenerate" };

export function useAdminSchedule() {
  const { data: session } = useSession();
  const isAdmin =
    session?.user?.activeType === "Admin" ||
    session?.user?.activeType === "SuperAdmin";
  const { routes, vehicles, refreshRoutes } = useAdminRides();
  const [date, setDate] = useState(() =>
    nextServiceDate(estDateKey(new Date())),
  );
  const [plan, setPlan] = useState<AutoSchedulePlan | null>(null);
  const [draft, setDraft] = useState<ScheduleAssignment[]>([]);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [stale, setStale] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<PendingScheduleAction | null>(null);
  const editPending = useRef(false);
  const routeRevision = useRef(0);
  const requestId = useRef(0);

  const load = useCallback(
    async (
      selectedDate: string,
      generate = false,
      quiet = false,
      signal?: AbortSignal,
    ) => {
      const id = ++requestId.current;
      setLoading(true);
      setGenerating(generate);
      try {
        while (!signal?.aborted && id === requestId.current) {
          const revision = routeRevision.current;
          const response = await fetch(
            `/api/routes/auto-schedule?date=${selectedDate}${generate ? "" : "&view=overview"}`,
          );
          const body = await readJson(response);

          if (id !== requestId.current || signal?.aborted) {
            return;
          }

          if (!response.ok) {
            throw new Error(body.error ?? "Unable to load schedule.");
          }

          const changedDuringRequest = revision !== routeRevision.current;

          // Read the overview again if an update arrived after this snapshot began.
          if (!generate && changedDuringRequest) {
            continue;
          }

          const next = body as AutoSchedulePlan;
          setPlan(next);
          setDraft(next.assignments);
          setGeneratedAt(generate ? new Date() : null);
          setStale(changedDuringRequest);

          if (changedDuringRequest) {
            toast.warn(
              "The schedule changed while generating. Re-generate before applying assignments.",
            );
          }
          if (!quiet) {
            const reviewIds = new Set([
              ...next.doubleBookings.flatMap((conflict) =>
                conflict.rides.map((ride) => ride.id),
              ),
              ...next.offShiftBookings.map(({ ride }) => ride.id),
              ...(generate ? next.unassigned.map((ride) => ride.id) : []),
            ]);

            if (reviewIds.size) {
              toast.warn(
                `${reviewIds.size} ${reviewIds.size === 1 ? "ride needs" : "rides need"} review. Check the assignment details below.`,
              );
            }
          }
          break;
        }
      } catch (error) {
        if (id !== requestId.current || signal?.aborted) {
          return;
        }

        setPlan(null);
        setDraft([]);
        setGeneratedAt(null);
        toast.error(
          error instanceof Error
            ? error.message
            : "Couldn't reach the server. Try again.",
        );
      } finally {
        if (id === requestId.current && !signal?.aborted) {
          setLoading(false);
          setGenerating(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const controller = new AbortController();
    // Loading the selected date intentionally synchronizes request state here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(date, false, false, controller.signal);

    return () => {
      controller.abort();
    };
  }, [date, isAdmin, load]);

  useRouteUpdates(() => {
    routeRevision.current++;

    if (!isAdmin || applying || loading) {
      return;
    }

    if (generatedAt) {
      requestId.current++;
      if (!stale) {
        toast.warn(
          "The schedule has changed. Re-generate to review current assignments before applying.",
        );
      }

      setStale(true);
    } else {
      void load(date, false, true);
    }
  });

  const changeDate = (next: string) => {
    if (!next || next === date) {
      return;
    }

    if (!isServiceDate(next)) {
      toast.warn(
        "Paratransit operates Monday–Friday, 7:30 AM–7:45 PM. Choose a weekday.",
      );

      return;
    }

    if (edited) {
      setPendingAction({ type: "changeDate", date: next });
      return;
    }

    selectDate(next);
  };

  function selectDate(next: string) {
    requestId.current++;
    setPlan(null);
    setDraft([]);
    setGeneratedAt(null);
    setLoading(true);
    setDate(next);
  }

  function generate() {
    if (busy) {
      return;
    }

    if (edited) {
      setPendingAction({ type: "regenerate" });
      return;
    }

    void load(date, true);
  }

  function confirmDiscard() {
    if (!pendingAction) {
      return;
    }

    setPendingAction(null);

    if (pendingAction.type === "changeDate") {
      selectDate(pendingAction.date);
    } else {
      void load(date, true);
    }
  }

  async function apply() {
    if (!plan || !draft.length || stale || editPending.current) {
      return;
    }

    setApplying(true);
    try {
      const response = await fetch("/api/routes/auto-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: plan.date, assignments: draft }),
      });
      const body = await readJson(response);

      if (!response.ok && response.status !== 207) {
        if (response.status === 409) {
          setStale(true);
        }

        toast.error(
          [
            body.error ?? "Couldn't apply assignments.",
            ...(body.details ?? []),
          ].join(" "),
        );

        return;
      }

      const results = (body.results ?? []) as {
        success: boolean;
        studentName: string;
        error?: string;
      }[];
      const successes = results.filter((r) => r.success).length;
      const failures = results.filter((r) => !r.success);
      const summary = `${successes} of ${results.length} rides successfully scheduled${failures.length ? `; ${failures.length} need review.` : "!"}`;
      const failureDetails = failures.map(
        (result) => `${result.studentName}: ${result.error}`,
      );

      toast[failures.length ? "warn" : "success"](
        [summary, ...failureDetails].join(" "),
      );
      refreshRoutes();
      await load(date, false, true);
    } catch {
      // The server may have booked rides before the connection was lost.
      setStale(true);
      toast.error(
        "Couldn't confirm the result. Refresh the schedule before trying again.",
      );
    } finally {
      setApplying(false);
      setConfirmOpen(false);
    }
  }

  const generated = generatedAt !== null;
  const busy = loading || applying || validating;
  const rideRows = buildScheduleRides(plan, draft, vehicles, generated);
  const drivers = (plan?.drivers ?? []).filter(
    (driver) =>
      driver.shifts.length ||
      driver.rides.length ||
      draft.some((assignment) => assignment.driverId === driver._id),
  );
  const unassignedCount = rideRows.filter(
    (ride) => ride.kind === "unassigned",
  ).length;
  const edited =
    JSON.stringify(draft) !== JSON.stringify(plan?.assignments ?? []);

  async function updateAssignment(
    id: string,
    field: "driverId" | "vehicleId",
    value: string,
  ) {
    if (busy || stale || !generated || editPending.current || !plan) {
      return;
    }

    const current = draft.find((a) => a.rideId === id);

    if (!current || current[field] === value) {
      return;
    }

    const ride = rideRows.find((r) => r.id === id);

    if (!ride || ride.kind !== "proposed") {
      return;
    }

    const next = draft.map((a) =>
      a.rideId === id ? { ...a, [field]: value } : a,
    );
    const version = requestId.current;
    editPending.current = true;
    setValidating(true);
    try {
      const response = await fetch("/api/routes/auto-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: plan.date,
          assignments: next,
          validateOnly: true,
        }),
      });
      const body = await readJson(response);

      if (version !== requestId.current) {
        return;
      }

      if (!response.ok || body.valid !== true) {
        const details = body.details?.length
          ? body.details.join(" ")
          : (body.error ?? "Couldn't validate this change. Try again.");
        toast.warn(
          `Couldn't change ${ride.studentName}'s assignment. ${details} Your draft was kept.`,
        );

        return;
      }

      setDraft(next);
      const driverName = plan.drivers.find((d) => d._id === value)?.name;
      toast.success(
        field === "driverId"
          ? `Moved ${ride.studentName} to ${driverName}`
          : `Updated ${ride.studentName}'s proposed vehicle`,
      );
    } catch {
      if (version === requestId.current) {
        toast.error(
          "Couldn't check this assignment. Your draft was kept. Check your connection and try again.",
        );
      }
    } finally {
      editPending.current = false;
      setValidating(false);
    }
  }

  return {
    isAdmin,
    routes,
    vehicles,
    date,
    plan,
    draft,
    generatedAt,
    loading,
    generating,
    applying,
    stale,
    confirmOpen,
    setConfirmOpen,
    validating,
    generated,
    busy,
    edited,
    rideRows,
    drivers,
    unassignedCount,
    changeDate,
    load,
    apply,
    updateAssignment,
    generate,
    pendingAction,
    dismissDiscard: () => setPendingAction(null),
    confirmDiscard,
  };
}
