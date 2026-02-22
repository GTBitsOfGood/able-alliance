import connectMongoDB from "../mongodb";
import RouteModel, { IRoute, RouteStatus } from "../models/RouteModel";
import LocationModel from "../models/LocationModel";
import UserModel from "../models/UserModel";
import VehicleModel from "../models/VehicleModel";
import { routeSchema } from "@/utils/types";
import {
  RouteAlreadyExistsException,
  RouteReferenceNotFoundException,
} from "@/utils/exceptions/route";

export async function createRoute(data: IRoute) {
  await connectMongoDB();
  const validatedData = routeSchema.parse(data);

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

  const route = await RouteModel.create({
    pickupLocation: validatedData.pickupLocation,
    dropoffLocation: validatedData.dropoffLocation,
    student: studentObj, // embed full student object
    scheduledPickupTime: validatedData.scheduledPickupTime,
    isActive: false,
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
  if (!route) {
    return null;
  }
  route.status = RouteStatus.Completed;
  await route.save();
  return route.toObject();
}
export async function cancelRoute(routeId: string) {
  await connectMongoDB();
  const route = await RouteModel.findById(routeId);
  if (!route) {
    return null;
  }
  route.status = RouteStatus.CancelledByStudent;
  await route.save();
  return route.toObject();
}
export async function scheduleRoute(
  routeId: string,
  driverId: string,
  vehicleId: string,
) {
  await connectMongoDB();
  // Find the route and ensure it's in Requested state
  const route = await RouteModel.findById(routeId);
  if (!route || route.status !== RouteStatus.Requested) {
    return null;
  }
  // Find driver and vehicle
  const driver = await UserModel.findById(driverId).lean();
  if (!driver || driver.type !== "Driver") {
    throw new RouteReferenceNotFoundException(
      "Driver not found or not a driver",
    );
  }
  const vehicle = await VehicleModel.findById(vehicleId).lean();
  if (!vehicle) {
    throw new RouteReferenceNotFoundException("Vehicle not found");
  }
  // Embed driver and vehicle, update status
  route.driver = driver;
  route.vehicle = vehicle;
  route.status = RouteStatus.Scheduled;
  await route.save();
  return route.toObject();
}
