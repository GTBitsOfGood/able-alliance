// Dummy User Model
import mongoose, { Schema } from "mongoose";
import type { UserInput } from "@/utils/types";

export type IUser = UserInput;

const UserSchema = new Schema<IUser>(
	{
		name: { type: String, required: true },
		email: { type: String, required: true, unique: true },
		role: { type: String, required: true },
	},
	{ versionKey: false },
);

const UserModel =
	(mongoose.models.User as mongoose.Model<IUser>) ??
	mongoose.model("User", UserSchema);

export default UserModel;