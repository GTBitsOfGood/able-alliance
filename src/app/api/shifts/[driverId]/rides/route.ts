import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import connectMongoDB from "@/server/db/mongodb";
import RouteModel, { RouteStatus } from "@/server/db/models/RouteModel";
import UserModel from "@/server/db/models/UserModel";
import VehicleModel from "@/server/db/models/VehicleModel";
import mongoose from "mongoose";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ driverId: string }> },
) {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }
  if (user.type !== "Admin" && user.type !== "SuperAdmin") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }

  const { driverId } = await params;
  if (!mongoose.Types.ObjectId.isValid(driverId)) {
    return NextResponse.json(
      { error: "Invalid driver ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  let body: { rides: Array<{ rideId: string; vehicleId: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  if (!Array.isArray(body.rides) || body.rides.length === 0) {
    return NextResponse.json(
      { error: "rides array is required and must not be empty" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  for (const r of body.rides) {
    if (!mongoose.Types.ObjectId.isValid(r.rideId)) {
      return NextResponse.json(
        { error: `Invalid rideId: ${r.rideId}` },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    if (!mongoose.Types.ObjectId.isValid(r.vehicleId)) {
      return NextResponse.json(
        { error: `Invalid vehicleId for ride ${r.rideId}` },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
  }

  try {
    await connectMongoDB();

    const driver = await UserModel.findById(driverId).lean();
    if (!driver || driver.type !== "Driver") {
      return NextResponse.json(
        { error: "Driver not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }

    const driverEmbed = {
      _id: driver._id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      email: driver.email,
      type: driver.type,
    };

    const results: Array<{ rideId: string; success: boolean; error?: string }> =
      [];

    for (const { rideId, vehicleId } of body.rides) {
      const [route, vehicle] = await Promise.all([
        RouteModel.findById(rideId),
        VehicleModel.findById(vehicleId).lean(),
      ]);

      if (!route) {
        results.push({ rideId, success: false, error: "Route not found" });
        continue;
      }
      if (route.status !== RouteStatus.Requested) {
        results.push({
          rideId,
          success: false,
          error: "Route is no longer in Requested status",
        });
        continue;
      }
      if (!vehicle) {
        results.push({ rideId, success: false, error: "Vehicle not found" });
        continue;
      }

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
      results.push({ rideId, success: true });
    }

    const allSucceeded = results.every((r) => r.success);
    return NextResponse.json(
      { results },
      { status: allSucceeded ? HTTP_STATUS_CODE.OK : 207 },
    );
  } catch (e) {
    console.error("[POST /api/shifts/[driverId]/rides]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
