"use client";

import React, { useEffect, useState } from "react";
import BogTable from "@/components/BogTable/BogTable";
import BogDropdown from "@/components/BogDropdown/BogDropdown";
import BogButton from "@/components/BogButton/BogButton";
import { RIDE_COLUMNS } from "./admin-table-data";
import type { TableRow } from "@/components/BogTable/BogTable";

type RouteEntry = {
  _id: string;
  student: { firstName: string; lastName: string };
  pickupLocation: string;
  dropoffLocation: string;
  scheduledPickupTime: string;
  status: string;
};

type DriverEntry = { _id: string; firstName: string; lastName: string };
type VehicleEntry = { _id: string; name: string; licensePlate: string };
type LocationEntry = { _id: string; name: string };

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
  const [locationMap, setLocationMap] = useState<Record<string, string>>({});
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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [routesRes, locationsRes, driversRes, vehiclesRes] =
          await Promise.all([
            fetch("/api/routes"),
            fetch("/api/locations"),
            fetch("/api/users?type=Driver"),
            fetch("/api/vehicles"),
          ]);

        if (!routesRes.ok) throw new Error(`Routes API ${routesRes.status}`);
        if (!locationsRes.ok)
          throw new Error(`Locations API ${locationsRes.status}`);
        if (!driversRes.ok) throw new Error(`Drivers API ${driversRes.status}`);
        if (!vehiclesRes.ok)
          throw new Error(`Vehicles API ${vehiclesRes.status}`);

        const [routesData, locationsData, driversData, vehiclesData] =
          await Promise.all([
            routesRes.json(),
            locationsRes.json(),
            driversRes.json(),
            vehiclesRes.json(),
          ]);

        const requested = Array.isArray(routesData)
          ? routesData.filter((r: RouteEntry) => r.status === "Requested")
          : [];

        const locMap: Record<string, string> = {};
        if (Array.isArray(locationsData)) {
          for (const loc of locationsData as LocationEntry[]) {
            locMap[String(loc._id)] = String(loc.name);
          }
        }
        if (cancelled) return;
        setRoutes(requested);
        setLocationMap(locMap);
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
          driverId: driver._id,
          vehicleId: vehicle._id,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? res.statusText);
      }
      setRoutes((prev) => prev.filter((r) => r._id !== routeId));
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
      setRoutes((prev) => prev.filter((r) => r._id !== routeId));
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
    const pickupName =
      locationMap[route.pickupLocation] ?? route.pickupLocation;
    const dropoffName =
      locationMap[route.dropoffLocation] ?? route.dropoffLocation;
    const pickupDate = route.scheduledPickupTime
      ? new Date(route.scheduledPickupTime).toLocaleDateString()
      : "—";
    const pickupTime = route.scheduledPickupTime
      ? new Date(route.scheduledPickupTime).toLocaleTimeString()
      : "—";

    const selectedDriver = driverLabels[route._id] ?? "";
    const selectedVehicle = vehicleLabels[route._id] ?? "";
    const bothSelected = !!selectedDriver && !!selectedVehicle;
    const isAssigning = assigning.has(route._id);
    const isCanceling = canceling.has(route._id);
    const assignError = assignErrors[route._id];
    const cancelError = cancelErrors[route._id];
    const activeError = assignError ?? cancelError;

    return {
      styleProps: { style: { verticalAlign: "middle" } },
      cells: [
        { content: studentName },
        {
          content: (
            <BogDropdown
              name={`driver-${route._id}`}
              options={driverOptions}
              placeholder="Select driver"
              value={selectedDriver}
              onSelectionChange={(v) => {
                const label = typeof v === "string" ? v : (v[0] ?? "");
                setDriverLabels((prev) => ({ ...prev, [route._id]: label }));
              }}
              style={{ fontSize: "1em" }}
            />
          ),
        },
        {
          content: (
            <BogDropdown
              name={`vehicle-${route._id}`}
              options={vehicleOptions}
              placeholder="Select vehicle"
              value={selectedVehicle}
              onSelectionChange={(v) => {
                const label = typeof v === "string" ? v : (v[0] ?? "");
                setVehicleLabels((prev) => ({ ...prev, [route._id]: label }));
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
                  onClick={() => handleAssign(route._id)}
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
                  onClick={() => handleCancel(route._id)}
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

  return (
    <BogTable columnHeaders={RIDE_COLUMNS} rows={rows} selectable={false} />
  );
}
