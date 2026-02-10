import connectMongoDB from "../mongodb";
import RouteModel, { IRoute } from "../models/RouteModel";
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
  const student = await UserModel.findById(validatedData.student).lean();
  if (!student) {
    throw new RouteReferenceNotFoundException("Student not found");
  }
  const studentType = (student as { type?: string }).type;
  if (studentType !== "Student") {
    throw new RouteReferenceNotFoundException(
      "Referenced user is not a student",
    );
  }
  if (validatedData.driver) {
    const driver = await UserModel.findById(validatedData.driver).lean();
    if (!driver) {
      throw new RouteReferenceNotFoundException("Driver not found");
    }
    const driverType = (driver as { type?: string }).type;
    if (driverType !== "Driver") {
      throw new RouteReferenceNotFoundException(
        "Referenced user is not a driver",
      );
    }
  }
  if (validatedData.vehicle) {
    const vehicle = await VehicleModel.findById(validatedData.vehicle);
    if (!vehicle) {
      throw new RouteReferenceNotFoundException("Vehicle not found");
    }
  }

  const existing = await RouteModel.findOne({
    student: validatedData.student,
    scheduledPickupTime: validatedData.scheduledPickupTime,
  });
  if (existing) {
    throw new RouteAlreadyExistsException();
  }

  const route = await RouteModel.create(validatedData);
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
    query.student = filters.student;
  }
  if (filters?.driver) {
    query.driver = filters.driver;
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
