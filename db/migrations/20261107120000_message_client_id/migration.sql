-- Sender-generated id for a send attempt, so a client can retry a message
-- whose acknowledgement was lost without creating a duplicate.
-- Nullable: every message written before this migration has no client id, and
-- a NULL never collides under a unique constraint in Postgres.
ALTER TABLE "Message" ADD COLUMN "clientId" UUID;

CREATE UNIQUE INDEX "Message_senderId_clientId_key"
    ON "Message" ("senderId", "clientId");
