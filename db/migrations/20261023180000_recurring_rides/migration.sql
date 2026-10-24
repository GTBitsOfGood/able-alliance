-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('weekly');

-- AlterTable
ALTER TABLE "Route" ADD COLUMN     "seriesId" UUID;

-- CreateTable
CREATE TABLE "RideSeries" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "pickupLocation" UUID NOT NULL,
    "dropoffLocation" UUID NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL DEFAULT 'weekly',
    "firstPickupTime" TIMESTAMPTZ(3) NOT NULL,
    "pickupWindowStartOffsetMs" INTEGER NOT NULL,
    "pickupWindowEndOffsetMs" INTEGER NOT NULL,
    "materializedThrough" TIMESTAMPTZ(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RideSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RideSeries_active_materializedThrough_idx" ON "RideSeries"("active", "materializedThrough");

-- CreateIndex
CREATE INDEX "RideSeries_studentId_idx" ON "RideSeries"("studentId");

-- CreateIndex
CREATE INDEX "RideSeries_pickupLocation_idx" ON "RideSeries"("pickupLocation");

-- CreateIndex
CREATE INDEX "RideSeries_dropoffLocation_idx" ON "RideSeries"("dropoffLocation");

-- CreateIndex
CREATE UNIQUE INDEX "Route_seriesId_scheduledPickupTime_key" ON "Route"("seriesId", "scheduledPickupTime");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "RideSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideSeries" ADD CONSTRAINT "RideSeries_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideSeries" ADD CONSTRAINT "RideSeries_pickupLocation_fkey" FOREIGN KEY ("pickupLocation") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideSeries" ADD CONSTRAINT "RideSeries_dropoffLocation_fkey" FOREIGN KEY ("dropoffLocation") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
