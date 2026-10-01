import connectMongoDB from "../mongodb";
import UserModel from "../models/UserModel";

/** Creates the initial SuperAdmin on server startup, if none exists. */
export async function initSuperAdmin() {
  const username = process.env.SUPERADMIN_CAS_USERNAME?.trim().toLowerCase();
  const firstName = process.env.SUPERADMIN_FIRSTNAME;
  const lastName = process.env.SUPERADMIN_LASTNAME;

  if (!username || !firstName || !lastName || !/^[a-z0-9]+$/.test(username)) {
    console.log(
      "[Init] Valid SUPERADMIN_CAS_USERNAME / SUPERADMIN_FIRSTNAME / SUPERADMIN_LASTNAME required — skipping SuperAdmin seed",
    );
    return;
  }
  const email = `${username}@gatech.edu`;

  await connectMongoDB();

  const existing = await UserModel.findOne({ type: "SuperAdmin" });
  if (existing) {
    console.log(`[Init] SuperAdmin already exists: ${existing.email}`);
    return;
  }

  await UserModel.create({
    firstName,
    lastName,
    email,
    username,
    type: "SuperAdmin",
  });
  console.log(`[Init] SuperAdmin created: ${email}`);
}
