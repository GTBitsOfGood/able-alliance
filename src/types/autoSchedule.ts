export type Point = { latitude: number; longitude: number };

export type Ride = {
  id: string;
  studentName: string;
  accommodations: string[];
  needsWheelchair: boolean;
  start: number;
  // Busy-until time used for conflict checks only: dropoff + boarding. Without
  // a stored estimate the dropoff comes from the locations' distance.
  end: number;
  pickupWindowStart: number;
  pickupWindowEnd: number;
  estimatedDropoff: number | null; // stored estimate only, never derived
  pickup: Point | null;
  dropoff: Point | null;
  pickupName: string;
  dropoffName: string;
  driverId?: string;
  vehicleId?: string;
  vehicleLabel?: string;
};

export type TimelineRide = Ride & {
  kind: "existing" | "proposed";
};

export type AutoSchedulePlan = {
  date: string;
  solverStatus: string;
  drivers: {
    _id: string;
    name: string;
    shifts: { start: number; end: number }[];
    rides: TimelineRide[];
  }[];
  assignments: { rideId: string; driverId: string; vehicleId: string }[];
  unassigned: (Ride & { reason: string })[];
  // Pre-existing bookings that already overlap; the solver never creates these.
  doubleBookings: {
    resource: "driver" | "vehicle";
    name: string;
    rides: [Ride, Ride];
  }[];
  // Pre-existing bookings not fully inside any of their driver's shifts.
  offShiftBookings: {
    driverName: string;
    shifts: { start: number; end: number }[];
    ride: Ride;
  }[];
};
