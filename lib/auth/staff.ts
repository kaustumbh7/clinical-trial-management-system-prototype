import { prisma } from "../db";
import { getRole } from "./role";

/**
 * Resolve the currently-signed-in staff user to a row in the StaffUser
 * directory. The mock role-switcher cookie carries a display name only;
 * here we match it to the directory by name. In production this would be
 * driven by the IdP subject.
 */
export async function getCurrentStaffUser() {
  const role = await getRole();
  if (role.kind !== "STAFF") return null;
  return prisma.staffUser.findFirst({ where: { name: role.name } });
}

/**
 * Default to the role's name for system rows, but require a real StaffUser
 * for authoring notes.
 */
export async function requireStaffUser() {
  const user = await getCurrentStaffUser();
  if (!user) {
    throw new Error(
      "Signed-in staff is not in the directory. Add them via /admin/staff first.",
    );
  }
  return user;
}
