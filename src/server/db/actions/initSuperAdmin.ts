import connectMongoDB from "../mongodb";
import UserModel from "../models/UserModel";

/**
 * Idempotent: creates the SuperAdmin user if none exists yet.
 * Reads SUPERADMIN_EMAIL and SUPERADMIN_NAME from env.
 * Called once on server startup via src/instrumentation.ts.
 */
export async function initSuperAdmin() {
  const email = process.env.SUPERADMIN_EMAIL;
  const firstName = process.env.SUPERADMIN_FIRSTNAME;
  const lastName = process.env.SUPERADMIN_LASTNAME;

  if (!email || !firstName || !lastName) {
    console.log(
      "[Init] SUPERADMIN_EMAIL / SUPERADMIN_FIRSTNAME / SUPERADMIN_LASTNAME not set — skipping SuperAdmin seed",
    );
    return;
  }

  await connectMongoDB();

  const existing = await UserModel.findOne({ type: "SuperAdmin" });
  if (existing) {
    console.log(`[Init] SuperAdmin already exists: ${existing.email}`);
    return;
  }

  await UserModel.create({ firstName, lastName, email, type: "SuperAdmin" });
  console.log(`[Init] SuperAdmin created: ${email}`);
}
