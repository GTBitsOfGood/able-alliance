-- Daily summary emails were never implemented; drop the unused preference.
ALTER TABLE "UserSettings" DROP COLUMN "dailySummary";
