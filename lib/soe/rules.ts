import { prisma } from "../db";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * Materialize a participant's task timeline from their study's SOE template.
 *
 * Called once at enrollment. Each `SoeTaskTemplate` produces one
 * `TaskInstance` anchored to the enrollment date (offset by the template's
 * timepoint dayOffset). Time-triggered tasks start PENDING and become DUE
 * when the sim clock passes their dueAt. Completion-triggered tasks start
 * PENDING and become DUE when their dependsOn task is COMPLETED. Manual
 * tasks start DUE immediately (currently only used for the consent task,
 * which is materialized BEFORE consent in a separate pre-enrollment step).
 */
export async function materializeTimeline(
  participantId: string,
  studyId: string,
  enrollmentDate: Date,
) {
  const templates = await prisma.soeTaskTemplate.findMany({
    where: { studyId, kind: { not: "CONSENT" } },
    include: { timepoint: true },
    orderBy: { sortOrder: "asc" },
  });

  const rows = templates.map((t) => {
    const offset = t.timepoint?.dayOffset ?? 0;
    const dueAt = addDays(enrollmentDate, offset);

    let availableAt: Date;
    if (t.triggerType === "TIME") {
      availableAt = dueAt;
    } else if (t.triggerType === "COMPLETION") {
      availableAt = enrollmentDate;
    } else {
      availableAt = enrollmentDate;
    }

    return {
      participantId,
      templateId: t.id,
      status: "PENDING" as const,
      dueAt,
      availableAt,
    };
  });

  if (rows.length > 0) {
    await prisma.taskInstance.createMany({ data: rows });
  }
  return rows.length;
}

/**
 * Materialize ONLY the consent task — needed before enrollment so the
 * participant has something to do in the portal between account creation
 * and signing consent.
 */
export async function materializeConsentTask(
  participantId: string,
  studyId: string,
  asOf: Date,
) {
  const consentTpl = await prisma.soeTaskTemplate.findFirst({
    where: { studyId, kind: "CONSENT" },
  });
  if (!consentTpl) return null;

  return prisma.taskInstance.create({
    data: {
      participantId,
      templateId: consentTpl.id,
      status: "DUE",
      dueAt: asOf,
      availableAt: asOf,
    },
  });
}
