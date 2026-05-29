import { prisma } from "../db";
import type { ActorRef } from "../soe/types";

/**
 * Append-only audit writer. The module exposes only `append` — there are no
 * update or delete code paths. In production, immutability would also be
 * enforced at the database role layer (no UPDATE/DELETE grant) and via
 * Merkle-root anchoring, per the proposal.
 */
export async function appendAudit(input: {
  actor: ActorRef;
  action: string;
  targetType: string;
  targetId: string;
  studyId?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditEvent.create({
    data: {
      actorKind: input.actor.kind,
      actorId: "id" in input.actor ? input.actor.id ?? null : null,
      actorLabel: input.actor.label,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      studyId: input.studyId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}
