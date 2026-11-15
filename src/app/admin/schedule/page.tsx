"use client";

import { useRef } from "react";

import ConfirmActionModal from "@/components/ConfirmActionModal/ConfirmActionModal";
import ScheduleDateNavigation from "@/components/admin/ScheduleDateNavigation";
import ScheduleSummary from "@/components/admin/ScheduleSummary";
import ScheduleTimeline from "@/components/admin/ScheduleTimeline";
import ScheduleAssignmentsTable from "@/components/admin/ScheduleAssignmentsTable";
import ScheduleApplyBar from "@/components/admin/ScheduleApplyBar";
import { useAdminSchedule } from "@/hooks/useAdminSchedule";

import styles from "@/components/admin/schedule.module.css";

export default function SchedulePage() {
  const schedule = useAdminSchedule();
  const tableRefs = useRef(new Map<string, HTMLTableRowElement>());

  function focusRide(rideId: string) {
    const row = tableRefs.current.get(rideId);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    row?.focus({ preventScroll: true });
  }

  return (
    <div className={styles.page}>
      <ScheduleDateNavigation
        date={schedule.date}
        routes={schedule.routes}
        busy={schedule.busy}
        isAdmin={schedule.isAdmin}
        changeDate={schedule.changeDate}
      />
      <ScheduleSummary
        date={schedule.date}
        hasPlan={schedule.plan !== null}
        rideCount={schedule.rideRows.length}
        requestedCount={schedule.draft.length + schedule.unassignedCount}
        driverCount={
          schedule.drivers.filter((driver) => driver.shifts.length).length
        }
        generatedAt={schedule.generatedAt}
        generated={schedule.generated}
        loading={schedule.loading}
        generating={schedule.generating}
        busy={schedule.busy}
        isAdmin={schedule.isAdmin}
        onGenerate={schedule.generate}
        onRefresh={() => void schedule.load(schedule.date)}
      />
      {schedule.loading && (
        <div className={styles.empty} role="status">
          {schedule.generating
            ? "Generating proposed assignments…"
            : "Loading daily schedule…"}
        </div>
      )}
      {!schedule.loading && !schedule.plan && (
        <div className={styles.empty}>
          <p>Unable to load this day’s schedule.</p>
          <button
            className={styles.btnSecondary}
            onClick={() => void schedule.load(schedule.date)}
          >
            Try again
          </button>
        </div>
      )}
      {!schedule.loading && schedule.plan && (
        <>
          <ScheduleTimeline
            drivers={schedule.drivers}
            rideRows={schedule.rideRows}
            generated={schedule.generated}
            proposedCount={schedule.draft.length}
            unassignedCount={schedule.unassignedCount}
            busy={schedule.busy}
            stale={schedule.stale}
            validating={schedule.validating}
            onReassign={(rideId, driverId) =>
              schedule.updateAssignment(rideId, "driverId", driverId)
            }
            onRideClick={focusRide}
          />
          <ScheduleAssignmentsTable
            rideRows={schedule.rideRows}
            drivers={schedule.plan.drivers}
            vehicles={schedule.vehicles}
            generated={schedule.generated}
            busy={schedule.busy}
            stale={schedule.stale}
            tableRefs={tableRefs}
            onAssignmentChange={schedule.updateAssignment}
          />
        </>
      )}
      {schedule.generated && schedule.plan && (
        <ScheduleApplyBar
          assignmentCount={schedule.draft.length}
          unassignedCount={schedule.unassignedCount}
          edited={schedule.edited}
          busy={schedule.busy}
          stale={schedule.stale}
          applying={schedule.applying}
          confirmOpen={schedule.confirmOpen}
          setConfirmOpen={schedule.setConfirmOpen}
          apply={schedule.apply}
        />
      )}
      <ConfirmActionModal
        open={schedule.pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) schedule.dismissDiscard();
        }}
        onConfirm={schedule.confirmDiscard}
        title="Discard assignment changes?"
        description="Your assignment edits have not been applied. Continuing will discard these edits."
        confirmLabel={
          schedule.pendingAction?.type === "regenerate"
            ? "Discard and regenerate"
            : "Discard and change date"
        }
        cancelLabel="Keep editing"
      />
    </div>
  );
}
