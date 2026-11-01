-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('Create', 'Update', 'Delete');

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" UUID,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "changes" JSONB NOT NULL,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEntry_entityType_entityId_createdAt_idx" ON "AuditEntry"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEntry_actorId_createdAt_idx" ON "AuditEntry"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEntry_createdAt_idx" ON "AuditEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
