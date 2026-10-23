"use client";

import React, { useEffect, useState } from "react";
import BogTable from "@/components/BogTable/BogTable";
import BogDropdown from "@/components/BogDropdown/BogDropdown";
import BogButton from "@/components/BogButton/BogButton";
import { RIDE_COLUMNS } from "./admin-table-data";
import type { TableRow } from "@/components/BogTable/BogTable";
import ConfirmActionModal from "@/components/ConfirmActionModal/ConfirmActionModal";

import type {
  RouteResponse as RouteEntry,
  UserResponse as DriverEntry,
} from "@/utils/types/api";
import type { Vehicle as VehicleEntry } from "@db/generated/browser";

function makeDriverLabel(d: DriverEntry) {
  return `${d.lastName}, ${d.firstName}`;
}

function makeVehicleLabel(v: VehicleEntry) {
  return `${v.name} (${v.licensePlate})`;
}

export default function RidesTable() {
  const [routes, setRoutes] = useState<RouteEntry[]>([]);
  const [drivers, setDrivers] = useState<DriverEntry[]>([]);
  const [vehicles, setVehicles] = useState<VehicleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-row selections keyed by routeId — store display labels for BogDropdown
  const [driverLabels, setDriverLabels] = useState<Record<string, string>>({});
  const [vehicleLabels, setVehicleLabels] = useState<Record<string, string>>(
    {},
  );
  const [assigning, setAssigning] = useState<Set<string>>(new Set());
  const [assignErrors, setAssignErrors] = useState<Record<string, string>>({});
  const [canceling, setCanceling] = useState<Set<string>>(new Set());
  const [cancelErrors, setCancelErrors] = useState<Record<string, string>>({});
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [routesRes, driversRes, vehiclesRes] = await Promise.all([
          fetch("/api/routes"),
          fetch("/api/users?type=Driver"),
          fetch("/api/vehicles"),
        ]);

        if (!routesRes.ok) throw new Error(`Routes API ${routesRes.status}`);
        if (!driversRes.ok) throw new Error(`Drivers API ${driversRes.status}`);
        if (!vehiclesRes.ok)
          throw new Error(`Vehicles API ${vehiclesRes.status}`);

        const [routesData, driversData, vehiclesData] = await Promise.all([
          routesRes.json(),
          driversRes.json(),
          vehiclesRes.json(),
        ]);

        const requested = Array.isArray(routesData)
          ? routesData.filter((r: RouteEntry) => r.status === "Requested")
          : [];

        if (cancelled) return;
        setRoutes(requested);
        setDrivers(Array.isArray(driversData) ? driversData : []);
        setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load rides.");
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAssign = async (routeId: string) => {
    const driverLabel = driverLabels[routeId];
    const vehicleLabel = vehicleLabels[routeId];
    if (!driverLabel || !vehicleLabel) return;

    const driver = drivers.find((d) => makeDriverLabel(d) === driverLabel);
    const vehicle = vehicles.find((v) => makeVehicleLabel(v) === vehicleLabel);
    if (!driver || !vehicle) return;

    setAssigning((prev) => new Set(prev).add(routeId));
    setAssignErrors((prev) => {
      const next = { ...prev };
      delete next[routeId];
      return next;
    });

    try {
      const res = await fetch("/api/routes/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId,
          driverId: driver.id,
          vehicleId: vehicle.id,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? res.statusText);
      }
      setRoutes((prev) => prev.filter((r) => r.id !== routeId));
    } catch (e) {
      setAssignErrors((prev) => ({
        ...prev,
        [routeId]: e instanceof Error ? e.message : "Assignment failed.",
      }));
    } finally {
      setAssigning((prev) => {
        const next = new Set(prev);
        next.delete(routeId);
        return next;
      });
    }
  };

  const handleCancel = async (routeId: string) => {
    setCanceling((prev) => new Set(prev).add(routeId));
    setCancelErrors((prev) => {
      const next = { ...prev };
      delete next[routeId];
      return next;
    });

    try {
      const res = await fetch("/api/routes/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? res.statusText);
      }
      setRoutes((prev) => prev.filter((r) => r.id !== routeId));
    } catch (e) {
      setCancelErrors((prev) => ({
        ...prev,
        [routeId]: e instanceof Error ? e.message : "Cancellation failed.",
      }));
    } finally {
      setCanceling((prev) => {
        const next = new Set(prev);
        next.delete(routeId);
        return next;
      });
    }
  };

  const driverOptions = drivers.map(makeDriverLabel);
  const vehicleOptions = vehicles.map(makeVehicleLabel);

  const rows: TableRow[] = routes.map((route) => {
    const studentName = `${route.student.firstName} ${route.student.lastName}`;
    const pickupName = route.pickup.name;
    const dropoffName = route.dropoff.name;
    const pickupDate = route.scheduledPickupTime
      ? new Date(route.scheduledPickupTime).toLocaleDateString("en-US", {
          timeZone: "America/New_York",
        })
      : "—";
    const pickupTime = route.scheduledPickupTime
      ? new Date(route.scheduledPickupTime).toLocaleTimeString("en-US", {
          timeZone: "America/New_York",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : "—";

    const selectedDriver = driverLabels[route.id] ?? "";
    const selectedVehicle = vehicleLabels[route.id] ?? "";
    const bothSelected = !!selectedDriver && !!selectedVehicle;
    const isAssigning = assigning.has(route.id);
    const isCanceling = canceling.has(route.id);
    const assignError = assignErrors[route.id];
    const cancelError = cancelErrors[route.id];
    const activeError = assignError ?? cancelError;

    return {
      cells: [
        { content: studentName },
        {
          content: (
            <BogDropdown
              name={`driver-${route.id}`}
              options={driverOptions}
              placeholder="Select driver"
              value={selectedDriver}
              onSelectionChange={(v) => {
                const label = typeof v === "string" ? v : (v[0] ?? "");
                setDriverLabels((prev) => ({ ...prev, [route.id]: label }));
              }}
              style={{ fontSize: "1em" }}
            />
          ),
        },
        {
          content: (
            <BogDropdown
              name={`vehicle-${route.id}`}
              options={vehicleOptions}
              placeholder="Select vehicle"
              value={selectedVehicle}
              onSelectionChange={(v) => {
                const label = typeof v === "string" ? v : (v[0] ?? "");
                setVehicleLabels((prev) => ({ ...prev, [route.id]: label }));
              }}
              style={{ fontSize: "1em" }}
            />
          ),
        },
        { content: pickupDate },
        { content: pickupTime },
        { content: pickupName },
        { content: dropoffName },
        {
          content: (
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <BogButton
                  variant="primary"
                  size="small"
                  disabled={isAssigning || isCanceling || !bothSelected}
                  onClick={() => handleAssign(route.id)}
                  style={
                    !bothSelected
                      ? {
                          backgroundColor: "var(--color-grey-off-state)",
                        }
                      : {}
                  }
                >
                  {isAssigning ? "Assigning…" : "Assign"}
                </BogButton>
                <BogButton
                  variant="secondary"
                  size="small"
                  disabled={isCanceling || isAssigning}
                  onClick={() => setPendingCancelId(route.id)}
                >
                  {isCanceling ? "Canceling…" : "Cancel"}
                </BogButton>
              </div>
              {activeError && (
                <p className="text-xs text-red-600">{activeError}</p>
              )}
            </div>
          ),
        },
      ],
    };
  });

  if (loading) return <p className="text-gray-600">Loading…</p>;
  if (error)
    return (
      <p className="mb-4 text-sm text-amber-700" role="status">
        {error}
      </p>
    );
  if (routes.length === 0)
    return <p className="text-gray-600">No requested rides.</p>;

  const pendingCancelRoute = pendingCancelId
    ? routes.find((r) => r.id === pendingCancelId)
    : undefined;

  return (
    <>
      <BogTable columnHeaders={RIDE_COLUMNS} rows={rows} selectable={false} />
      <ConfirmActionModal
        open={pendingCancelId !== null}
        onOpenChange={(o) => {
          if (!o) setPendingCancelId(null);
        }}
        onConfirm={async () => {
          if (!pendingCancelId) return;
          await handleCancel(pendingCancelId);
          setPendingCancelId(null);
        }}
        title="Cancel this ride?"
        description={
          pendingCancelRoute
            ? `This cancels the requested ride for ${pendingCancelRoute.student.firstName} ${pendingCancelRoute.student.lastName}. This action cannot be undone.`
            : "This cancels the requested ride. This action cannot be undone."
        }
        confirmLabel="Cancel ride"
        confirmingLabel="Canceling…"
        cancelLabel="Keep ride"
        confirming={pendingCancelId !== null && canceling.has(pendingCancelId)}
      />
    </>
  );
}
