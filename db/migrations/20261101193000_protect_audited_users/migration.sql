-- Preserve a real foreign key for User audit subjects. The generic entityId
-- cannot have a foreign key because it can refer to several different tables.
ALTER TABLE "AuditEntry" ADD COLUMN "subjectUserId" UUID;

UPDATE "AuditEntry"
SET "subjectUserId" = "entityId"
WHERE "entityType" = 'User';

CREATE INDEX "AuditEntry_subjectUserId_createdAt_idx" ON "AuditEntry"("subjectUserId", "createdAt");

ALTER TABLE "AuditEntry"
ADD CONSTRAINT "AuditEntry_subjectUserId_fkey"
FOREIGN KEY ("subjectUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
