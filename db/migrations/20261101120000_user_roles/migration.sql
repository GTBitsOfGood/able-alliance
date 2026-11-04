-- Preserve each existing user's assigned type as a one-element array.
ALTER TABLE "User" ADD COLUMN "types" "UserType"[];
UPDATE "User" SET "types" = ARRAY["type"];
ALTER TABLE "User" ALTER COLUMN "types" SET NOT NULL;
DROP INDEX "User_type_status_idx";
ALTER TABLE "User" DROP COLUMN "type";
CREATE INDEX "User_types_idx" ON "User" USING GIN ("types");
CREATE INDEX "User_status_idx" ON "User" ("status");
ALTER TABLE "User" ADD CONSTRAINT "User_types_valid" CHECK (
  cardinality("types") BETWEEN 1 AND 4
  AND array_position("types", NULL) IS NULL
  AND cardinality("types") =
    (CASE WHEN 'Student' = ANY("types") THEN 1 ELSE 0 END
     + CASE WHEN 'Driver' = ANY("types") THEN 1 ELSE 0 END
     + CASE WHEN 'Admin' = ANY("types") THEN 1 ELSE 0 END
     + CASE WHEN 'SuperAdmin' = ANY("types") THEN 1 ELSE 0 END)
);

-- Assigned types are permanent after invitation, including for administrators.
CREATE FUNCTION prevent_user_types_change() RETURNS trigger AS $$
BEGIN
  IF NEW."types" IS DISTINCT FROM OLD."types" THEN
    RAISE EXCEPTION 'User types cannot be changed after invitation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "User_types_immutable" BEFORE UPDATE OF "types" ON "User"
FOR EACH ROW EXECUTE FUNCTION prevent_user_types_change();
