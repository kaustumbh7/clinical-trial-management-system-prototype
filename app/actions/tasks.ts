"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getRole, roleLabel } from "@/lib/auth/role";
import { handleEvent } from "@/lib/soe/engine";

export async function actCompleteTask(taskId: string) {
  const role = await getRole();
  const actorLabel = roleLabel(role);

  if (role.kind === "PARTICIPANT") {
    const task = await prisma.taskInstance.findUnique({
      where: { id: taskId },
      select: { participantId: true },
    });
    if (!task || task.participantId !== role.participantId) {
      throw new Error("Forbidden");
    }
  } else if (role.kind !== "STAFF") {
    throw new Error("Not signed in");
  }

  await handleEvent({ kind: "TASK_COMPLETED", taskId, actorLabel });
  revalidatePath("/portal", "layout");
  revalidatePath("/admin", "layout");
  redirect("/portal");
}
