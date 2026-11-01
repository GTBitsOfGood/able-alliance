-- CreateEnum
CREATE TYPE "Status" AS ENUM ('active', 'archived');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE INDEX "User_type_status_idx" ON "User"("type", "status");

-- CreateIndex
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");

-- CreateIndex
CREATE INDEX "Location_status_idx" ON "Location"("status");
