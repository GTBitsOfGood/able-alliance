-- AlterTable
ALTER TABLE "RideSeries" ADD COLUMN     "daysOfWeek" INTEGER[],
ADD COLUMN     "endsAt" TIMESTAMPTZ(3);

-- Existing series repeat on the Eastern weekday of their first ride.
UPDATE "RideSeries"
SET "daysOfWeek" = ARRAY[EXTRACT(DOW FROM "firstPickupTime" AT TIME ZONE 'America/New_York')::INTEGER];
