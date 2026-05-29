import { cookies } from "next/headers";

export type AppRole =
  | { kind: "ANONYMOUS" }
  | { kind: "STAFF"; role: "PI" | "COORDINATOR"; name: string }
  | { kind: "PARTICIPANT"; participantId: string; name: string };

const COOKIE = "ctms_role";

export async function getRole(): Promise<AppRole> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return { kind: "ANONYMOUS" };
  try {
    return JSON.parse(raw) as AppRole;
  } catch {
    return { kind: "ANONYMOUS" };
  }
}

export async function setRole(role: AppRole) {
  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify(role), {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearRole() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function roleLabel(role: AppRole): string {
  if (role.kind === "ANONYMOUS") return "Guest";
  if (role.kind === "STAFF") return `${role.role === "PI" ? "PI" : "Coordinator"} · ${role.name}`;
  return `Participant · ${role.name}`;
}
