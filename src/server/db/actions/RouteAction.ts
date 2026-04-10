import connectMongoDB from "../mongodb";
import RouteModel, { RouteStatus } from "../models/RouteModel";
import LocationModel from "../models/LocationModel";
import UserModel from "../models/UserModel";
import VehicleModel from "../models/VehicleModel";
import { createRouteSchema, type CreateRouteInput } from "@/utils/types";
import {
  RouteAlreadyExistsException,
  RouteReferenceNotFoundException,
  DriverNotAvailableException,
} from "@/utils/exceptions/route";
import { getMapboxTravelDuration } from "@/server/mapbox";
import { estDayOfWeek, estTimeStr } from "@/utils/dateEst";

export async function createRoute(data: CreateRouteInput) {
  await connectMongoDB();
  const validatedData = createRouteSchema.parse(data);

  const pickupLoc = await LocationModel.findById(validatedData.pickupLocation);
  if (!pickupLoc) {
    throw new RouteReferenceNotFoundException("Pickup location not found");
  }
  const dropoffLoc = await LocationModel.findById(
    validatedData.dropoffLocation,
  );
  if (!dropoffLoc) {
    throw new RouteReferenceNotFoundException("Dropoff location not found");
  }
  const studentObj = await UserModel.findById(validatedData.student).lean();
  if (!studentObj) {
    throw new RouteReferenceNotFoundException("Student not found");
  }
  const studentType = (studentObj as { type?: string }).type;
  if (studentType !== "Student") {
    throw new RouteReferenceNotFoundException(
      "Referenced user is not a student",
    );
  }

  const existing = await RouteModel.findOne({
    "student._id": studentObj._id,
    scheduledPickupTime: validatedData.scheduledPickupTime,
  });
  if (existing) {
    throw new RouteAlreadyExistsException();
  }

  const studentEmbed = {
    _id: studentObj._id,
    firstName: studentObj.firstName,
    lastName: studentObj.lastName,
    email: studentObj.email,
    type: studentObj.type,
    studentInfo:
      (studentObj as { studentInfo?: Record<string, unknown> }).studentInfo ??
      {},
  };

  const durationSeconds = await getMapboxTravelDuration(
    pickupLoc.latitude,
    pickupLoc.longitude,
    dropoffLoc.latitude,
    dropoffLoc.longitude,
    validatedData.scheduledPickupTime,
  );

  const estimatedDropoffTime =
    durationSeconds !== null
      ? new Date(
          validatedData.scheduledPickupTime.getTime() + durationSeconds * 1000,
        )
      : undefined;

  const route = await RouteModel.create({
    pickupLocation: validatedData.pickupLocation,
    dropoffLocation: validatedData.dropoffLocation,
    student: studentEmbed,
    scheduledPickupTime: validatedData.scheduledPickupTime,
    pickupWindowStart: validatedData.pickupWindowStart,
    pickupWindowEnd: validatedData.pickupWindowEnd,
    estimatedDropoffTime,
    status: "Requested",
  });
  return route.toObject();
}

export async function getRouteById(id: string) {
  await connectMongoDB();
  const route = await RouteModel.findById(id).lean();
  return route;
}

export async function deleteRouteById(id: string) {
  await connectMongoDB();
  const deleted = await RouteModel.findByIdAndDelete(id).lean();
  return deleted;
}

export async function getRoutes(filters?: {
  student?: string;
  driver?: string;
  vehicle?: string;
  start_time?: Date;
  end_time?: Date;
}) {
  await connectMongoDB();

  const query: Record<string, unknown> = {};

  if (filters?.student) {
    query["student._id"] = filters.student;
  }
  if (filters?.driver) {
    query["driver._id"] = filters.driver;
  }
  if (filters?.vehicle) {
    query["vehicle._id"] = filters.vehicle;
  }
  if (filters?.start_time != null || filters?.end_time != null) {
    query.scheduledPickupTime = {};
    if (filters?.start_time != null) {
      (query.scheduledPickupTime as Record<string, Date>).$gte =
        filters.start_time;
    }
    if (filters?.end_time != null) {
      (query.scheduledPickupTime as Record<string, Date>).$lte =
        filters.end_time;
    }
  }

  const routes = await RouteModel.find(query).lean();
  return routes;
}

export async function completeRoute(routeId: string) {
  await connectMongoDB();
  const route = await RouteModel.findById(routeId);
  if (!route) return null;
  if (route.status !== RouteStatus.Pickedup) return null;
  route.status = RouteStatus.Completed;
  await route.save();
  return route.toObject();
}
export async function cancelRoute(routeId: string, status?: string) {
  await connectMongoDB();
  const route = await RouteModel.findById(routeId);
  if (!route) {
    return null;
  }
  if (status && Object.values(RouteStatus).includes(status as RouteStatus)) {
    route.status = status as RouteStatus;
  } else {
    route.status = RouteStatus.CancelledByStudent;
  }
  await route.save();
  return route.toObject();
}

export async function startRoute(routeId: string) {
  await connectMongoDB();
  const route = await RouteModel.findById(routeId);
  if (!route || route.status !== RouteStatus.Scheduled) {
    return null;
  }
  route.status = RouteStatus.EnRoute;
  await route.save();
  return route.toObject();
}

export async function pickupStudent(routeId: string) {
  await connectMongoDB();
  const route = await RouteModel.findById(routeId);
  if (!route || route.status !== RouteStatus.EnRoute) return null;
  route.status = RouteStatus.Pickedup;
  await route.save();
  return route.toObject();
}

export async function markRouteMissing(routeId: string) {
  await connectMongoDB();
  const route = await RouteModel.findById(routeId);
  if (!route) return null;
  if (
    route.status !== RouteStatus.Scheduled &&
    route.status !== RouteStatus.EnRoute
  ) {
    return null;
  }
  route.status = RouteStatus.Missing;
  await route.save();
  return route.toObject();
}

export async function scheduleRoute(
  routeId: string,
  driverId: string,
  vehicleId: string,
) {
  await connectMongoDB();

  // Fetch route, driver, and vehicle in parallel
  const [route, driver, vehicle] = await Promise.all([
    RouteModel.findById(routeId),
    UserModel.findById(driverId).lean(),
    VehicleModel.findById(vehicleId).lean(),
  ]);

  if (!route || route.status !== RouteStatus.Requested) {
    return null;
  }

  if (!driver || driver.type !== "Driver") {
    throw new RouteReferenceNotFoundException(
      "Driver not found or not a driver",
    );
  }

  if (!vehicle) {
    throw new RouteReferenceNotFoundException("Vehicle not found");
  }

  // Check if driver is available at the scheduled time (in EST/EDT)
  const pickupTime = route.scheduledPickupTime;
  const dayOfWeek = estDayOfWeek(pickupTime); // 0=Sun, 6=Sat in America/New_York
  const timeStr = estTimeStr(pickupTime); // HH:MM in America/New_York

  const driverShifts =
    (
      driver as {
        shifts?: Array<{
          dayOfWeek: number;
          startTime: string;
          endTime: string;
        }>;
      }
    ).shifts || [];
  const isAvailable = driverShifts.some(
    (shift) =>
      shift.dayOfWeek === dayOfWeek &&
      shift.startTime <= timeStr &&
      timeStr <= shift.endTime,
  );

  if (!isAvailable) {
    throw new DriverNotAvailableException();
  }
  const driverEmbed = {
    _id: driver._id,
    firstName: driver.firstName,
    lastName: driver.lastName,
    email: driver.email,
    type: driver.type,
  };
  const vehicleEmbed = {
    _id: vehicle._id,
    vehicleId: vehicle.vehicleId,
    name: vehicle.name,
    licensePlate: vehicle.licensePlate,
    description: vehicle.description,
    accessibility: vehicle.accessibility,
    seatCount: vehicle.seatCount,
  };
  route.driver = driverEmbed;
  route.vehicle = vehicleEmbed;
  route.status = RouteStatus.Scheduled;
  await route.save();
  return route.toObject();
}
