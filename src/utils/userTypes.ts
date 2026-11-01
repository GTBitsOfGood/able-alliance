import type { UserType } from "@db/generated/enums";

export const USER_TYPES: UserType[] = [
  "Student",
  "Driver",
  "Admin",
  "SuperAdmin",
];

type TypedUser = { types: readonly UserType[] };

export function hasUserType(user: TypedUser, role: UserType): boolean {
  return user.types.includes(role);
}

export function hasAdminType(user: TypedUser): boolean {
  return hasUserType(user, "Admin") || hasUserType(user, "SuperAdmin");
}

export function userTypeLabel(role: UserType) {
  return role === "SuperAdmin" ? "Super Admin" : role;
}

export function userTypeHome(role: UserType) {
  return role === "Admin" || role === "SuperAdmin" ? "/admin" : "/rides";
}

export function userTypeFilter(role: UserType) {
  return { types: { has: role } };
}

export function isAdmin(type: string | null | undefined): boolean {
  return type === "Admin" || type === "SuperAdmin";
}
