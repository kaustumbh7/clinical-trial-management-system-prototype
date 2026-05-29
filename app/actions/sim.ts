"use server";

import { revalidatePath } from "next/cache";
import { advanceSimClock, handleEvent } from "@/lib/soe/engine";
import { getSimNow } from "@/lib/sim-clock";
import { getRole, roleLabel } from "@/lib/auth/role";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function actAdvanceSim(days: number) {
  const role = await getRole();
  const actorLabel = role.kind === "STAFF" ? roleLabel(role) : "anonymous";
  const now = await getSimNow();
  const target = new Date(now.getTime() + days * MS_PER_DAY);
  const result = await advanceSimClock(target, actorLabel);
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  return result;
}

export async function actFireWebhook(
  vendor: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  await handleEvent({
    kind: "WEBHOOK_RECEIVED",
    vendor,
    type,
    payload,
  });
  revalidatePath("/admin", "layout");
}
