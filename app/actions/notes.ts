"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { appendAudit } from "@/lib/audit/log";
import { requireStaffUser } from "@/lib/auth/staff";
import { getSimNow } from "@/lib/sim-clock";

/**
 * Parse "@name" mentions out of the body, match them against the staff
 * directory, and return both stripped body + matched ids.
 */
async function resolveMentions(body: string) {
  const tokens = Array.from(body.matchAll(/@([a-z0-9._-]+)/gi)).map(
    (m) => m[1],
  );
  if (tokens.length === 0) return [];
  const matches = await prisma.staffUser.findMany({
    where: {
      OR: tokens.map((t) => ({
        name: { contains: t },
      })),
    },
  });
  return matches.map((m) => m.id);
}

export async function actPostNote(formData: FormData) {
  const author = await requireStaffUser();
  const targetType = formData.get("targetType") as string;
  const targetId = formData.get("targetId") as string;
  const body = (formData.get("body") as string)?.trim();
  const revalidate = (formData.get("revalidate") as string) || null;
  if (!targetType || !targetId || !body) {
    throw new Error("Target + body required");
  }
  const mentions = await resolveMentions(body);
  const note = await prisma.internalNote.create({
    data: {
      authorId: author.id,
      targetType,
      targetId,
      body,
      mentions: mentions.length ? JSON.stringify(mentions) : null,
      createdAt: await getSimNow(),
    },
  });
  await appendAudit({
    actor: { kind: "STAFF", id: author.id, label: author.name },
    action: "INTERNAL_NOTE_POSTED",
    targetType,
    targetId,
    metadata: { mentions, length: body.length },
  });
  if (revalidate) revalidatePath(revalidate);
}

export async function actResolveNote(noteId: string, revalidate?: string) {
  const author = await requireStaffUser();
  const note = await prisma.internalNote.findUniqueOrThrow({
    where: { id: noteId },
  });
  if (note.resolvedAt) return;
  await prisma.internalNote.update({
    where: { id: noteId },
    data: { resolvedAt: await getSimNow() },
  });
  await appendAudit({
    actor: { kind: "STAFF", id: author.id, label: author.name },
    action: "INTERNAL_NOTE_RESOLVED",
    targetType: note.targetType,
    targetId: note.targetId,
  });
  if (revalidate) revalidatePath(revalidate);
}
