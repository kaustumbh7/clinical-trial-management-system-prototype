"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { appendAudit } from "@/lib/audit/log";
import { setRole } from "@/lib/auth/role";
import { ensureConsentTask } from "./consent";

const ScreenerSchema = z.object({
  studyId: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email(),
  age: z.coerce.number().int().min(0).max(120),
  sensitiveSkin: z.enum(["yes", "no", "unsure"]),
  usesDeodorantDaily: z.enum(["yes", "no"]),
  hasKnownAllergy: z.enum(["yes", "no"]),
  livesInUS: z.enum(["yes", "no"]),
});

export type ScreenerOutcome =
  | { kind: "QUALIFIED"; participantId: string }
  | { kind: "WAITLIST"; reason: string }
  | { kind: "DISQUALIFIED"; reason: string };

export async function actSubmitScreener(formData: FormData) {
  const parsed = ScreenerSchema.safeParse({
    studyId: formData.get("studyId"),
    name: formData.get("name"),
    email: formData.get("email"),
    age: formData.get("age"),
    sensitiveSkin: formData.get("sensitiveSkin"),
    usesDeodorantDaily: formData.get("usesDeodorantDaily"),
    hasKnownAllergy: formData.get("hasKnownAllergy"),
    livesInUS: formData.get("livesInUS"),
  });

  if (!parsed.success) {
    redirect(`/screener/${formData.get("studyId")}?error=invalid`);
  }

  const data = parsed.data;
  const study = await prisma.study.findUnique({
    where: { id: data.studyId },
    include: { arms: { include: { _count: { select: { participants: true } } } } },
  });
  if (!study) {
    redirect("/");
  }

  const outcome = evaluateEligibility(data, study.arms);

  const answers = {
    age: data.age,
    sensitiveSkin: data.sensitiveSkin,
    usesDeodorantDaily: data.usesDeodorantDaily,
    hasKnownAllergy: data.hasKnownAllergy,
    livesInUS: data.livesInUS,
  };

  const screener = await prisma.screenerResponse.create({
    data: {
      studyId: study.id,
      leadName: data.name,
      leadEmail: data.email,
      answers: JSON.stringify(answers),
      outcome: outcome.kind,
    },
  });

  await appendAudit({
    actor: { kind: "PARTICIPANT", id: screener.id, label: data.name },
    action: "SCREENER_SUBMITTED",
    targetType: "ScreenerResponse",
    targetId: screener.id,
    studyId: study.id,
    metadata: { outcome: outcome.kind },
  });

  if (outcome.kind === "QUALIFIED") {
    // Pick an arm with capacity
    const armChoice =
      study.arms.find((a) => a._count.participants < a.capacity) ??
      study.arms[0];
    const participant = await prisma.participant.create({
      data: {
        studyId: study.id,
        armId: armChoice?.id,
        name: data.name,
        email: data.email,
        status: "SCREENED",
      },
    });
    await appendAudit({
      actor: { kind: "SYSTEM", label: "screener-flow" },
      action: "PARTICIPANT_CREATED",
      targetType: "Participant",
      targetId: participant.id,
      studyId: study.id,
      metadata: { from: "screener", arm: armChoice?.name },
    });
    await ensureConsentTask(participant.id, study.id);

    await setRole({
      kind: "PARTICIPANT",
      participantId: participant.id,
      name: participant.name,
    });
    redirect("/portal");
  }

  redirect(`/screener/${study.id}/result?o=${outcome.kind}`);
}

function evaluateEligibility(
  data: z.infer<typeof ScreenerSchema>,
  arms: Array<{ capacity: number; _count: { participants: number } }>,
): ScreenerOutcome {
  if (data.livesInUS !== "yes") {
    return {
      kind: "DISQUALIFIED",
      reason: "Study currently enrolls US-based participants only.",
    };
  }
  if (data.hasKnownAllergy === "yes") {
    return {
      kind: "DISQUALIFIED",
      reason: "Reported deodorant ingredient allergy — exclusion criterion.",
    };
  }
  if (data.age < 18 || data.age > 65) {
    return {
      kind: "DISQUALIFIED",
      reason: "This study enrolls adults aged 18–65.",
    };
  }
  if (data.usesDeodorantDaily !== "yes") {
    return {
      kind: "DISQUALIFIED",
      reason: "Requires established daily deodorant use.",
    };
  }
  const capacityAvailable = arms.some(
    (a) => a._count.participants < a.capacity,
  );
  if (!capacityAvailable) {
    return {
      kind: "WAITLIST",
      reason: "All arms at capacity — added to the waitlist.",
    };
  }
  return { kind: "QUALIFIED", participantId: "" };
}
