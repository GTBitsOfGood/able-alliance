-- Enable notifications by default for newly created user settings.
-- Preserve existing users' saved preferences.
ALTER TABLE "UserSettings"
    ALTER COLUMN "dailySummary" SET DEFAULT true,
    ALTER COLUMN "driverAssigned" SET DEFAULT true,
    ALTER COLUMN "driverEnRoute" SET DEFAULT true,
    ALTER COLUMN "rideCancelled" SET DEFAULT true,
    ALTER COLUMN "rideAssigned" SET DEFAULT true,
    ALTER COLUMN "rideCompleted" SET DEFAULT true,
    ALTER COLUMN "rideDelayed" SET DEFAULT true,
    ALTER COLUMN "newMessageFromDriver" SET DEFAULT true;
