"use server";

import { redirect } from "next/navigation";
import { setRole, clearRole, type AppRole } from "@/lib/auth/role";

export async function actAssumeRole(role: AppRole, redirectTo?: string) {
  await setRole(role);
  if (redirectTo) redirect(redirectTo);
}

export async function actClearRole(redirectTo: string = "/") {
  await clearRole();
  redirect(redirectTo);
}
