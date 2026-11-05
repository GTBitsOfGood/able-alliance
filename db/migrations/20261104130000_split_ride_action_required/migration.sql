ALTER TYPE "RouteStatus" RENAME VALUE 'ActionRequired' TO 'ActionRequiredByAdmin';
ALTER TYPE "RouteStatus" ADD VALUE 'ActionRequiredByStudent';

-- CreateTable
CREATE TABLE "ProposedRideChange" (
    "id" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "requestedByRole" "UserType" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickupLocation" UUID NOT NULL,
    "dropoffLocation" UUID NOT NULL,
    "scheduledPickupTime" TIMESTAMPTZ(3) NOT NULL,
    "pickupWindowStart" TIMESTAMPTZ(3) NOT NULL,
    "pickupWindowEnd" TIMESTAMPTZ(3) NOT NULL,
    "estimatedDropoffTime" TIMESTAMPTZ(3),

    CONSTRAINT "ProposedRideChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProposedRideChange_routeId_key" ON "ProposedRideChange"("routeId");

-- AddForeignKey
ALTER TABLE "ProposedRideChange" ADD CONSTRAINT "ProposedRideChange_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposedRideChange" ADD CONSTRAINT "ProposedRideChange_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposedRideChange" ADD CONSTRAINT "ProposedRideChange_pickupLocation_fkey" FOREIGN KEY ("pickupLocation") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposedRideChange" ADD CONSTRAINT "ProposedRideChange_dropoffLocation_fkey" FOREIGN KEY ("dropoffLocation") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
