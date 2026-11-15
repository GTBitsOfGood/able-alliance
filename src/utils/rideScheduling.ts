import type { Point, Ride } from "@/types/autoSchedule";
import { MINUTES_PER_DAY } from "./dateEst";

// Parking, unloading, and check-in time between rides.
const BASE_TURNAROUND_MINUTES = 5;
const ROAD_DISTANCE_FACTOR = 1.4;
const AVERAGE_SPEED_KMH = 30;

export function estimateTravelMinutes(
  from: Point | null,
  to: Point | null,
): number {
  if (!from || !to) {
    return 15;
  }

  const radiansPerDegree = Math.PI / 180;
  const latitudeDifference = (to.latitude - from.latitude) * radiansPerDegree;
  const longitudeDifference =
    (to.longitude - from.longitude) * radiansPerDegree;
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(from.latitude * radiansPerDegree) *
      Math.cos(to.latitude * radiansPerDegree) *
      Math.sin(longitudeDifference / 2) ** 2;
  const distanceKm = 6371 * 2 * Math.asin(Math.sqrt(haversine));

  return Math.ceil(
    ((distanceKm * ROAD_DISTANCE_FACTOR) / AVERAGE_SPEED_KMH) * 60,
  );
}

function canFollow(firstRide: Ride, nextRide: Ride): boolean {
  return (
    firstRide.end +
      BASE_TURNAROUND_MINUTES +
      estimateTravelMinutes(firstRide.dropoff, nextRide.pickup) <=
    nextRide.start
  );
}

export function areRidesCompatible(firstRide: Ride, secondRide: Ride): boolean {
  return canFollow(firstRide, secondRide) || canFollow(secondRide, firstRide);
}

/** Include bookings that cross midnight into the selected schedule day. */
export function rideTouchesDay(ride: Ride): boolean {
  return ride.end > 0 && ride.start < MINUTES_PER_DAY;
}
