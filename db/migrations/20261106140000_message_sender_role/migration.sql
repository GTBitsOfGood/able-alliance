ALTER TABLE "Message" ADD COLUMN "senderType" "UserType";

UPDATE "Message" AS message
SET "senderType" = COALESCE(account.types[1], 'Student'::"UserType")
FROM "User" AS account
WHERE message."senderId" = account.id;

ALTER TABLE "Message" ALTER COLUMN "senderType" SET NOT NULL;

