import connectMongoDB from "../mongodb";
import RouteModel, { IRoute } from "../models/RouteModel";
import { routeSchema } from "@/utils/types";
import { RouteAlreadyExistsException } from "@/utils/exceptions/route";

export async function createRoute(data: IRoute) {
  await connectMongoDB();
  // assume a student can only be on one ride at once
  const existing = await RouteModel.findOne({ student: data.student });
  if (existing) {
    throw new RouteAlreadyExistsException();
  }
  // should validate route data before creating
  const validatedData = routeSchema.parse(data);
  const route = await RouteModel.create(validatedData);
  return route.toObject();
}

export async function getRouteById(id: string) {
  await connectMongoDB();
  const route = await RouteModel.findById(id).lean();
  return route;
}

export async function getRoutes(filters?: {
  pickupTime?: Date;
  studentId?: string;
  driverId?: string;
}) {
  await connectMongoDB();

  interface routeFilters {
    student?: string;
    driver?: string;
    scheduledPickupTime?: Date;
  }

  const query: routeFilters = {};

  if (filters?.pickupTime) {
    query.scheduledPickupTime = filters.pickupTime;
  }

  if (filters?.studentId) {
    query.student = filters.studentId;
  }

  if (filters?.driverId) {
    query.driver = filters.driverId;
  }

  const routes = await RouteModel.find(query).lean();
  return routes;
}
