"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { appendAudit } from "@/lib/audit/log";
import { getRole, roleLabel } from "@/lib/auth/role";
import { getSimNow } from "@/lib/sim-clock";

async function requireStaff() {
  const role = await getRole();
  if (role.kind !== "STAFF") throw new Error("Staff only");
  return role;
}

export async function actCreatePaymentRule(formData: FormData) {
  const role = await requireStaff();
  const studyId = formData.get("studyId") as string;
  const name = (formData.get("name") as string)?.trim();
  const trigger = (formData.get("trigger") as string) || "TASK_COMPLETED";
  const templateId = (formData.get("templateId") as string) || null;
  const amountDollars = parseFloat((formData.get("amountDollars") as string) || "0");
  if (!studyId || !name || amountDollars <= 0) {
    throw new Error("Study, name, and positive amount required");
  }

  const rule = await prisma.paymentRule.create({
    data: {
      studyId,
      name,
      trigger,
      templateId,
      amountCents: Math.round(amountDollars * 100),
      currency: "USD",
      active: true,
    },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "PAYMENT_RULE_CREATED",
    targetType: "PaymentRule",
    targetId: rule.id,
    studyId,
    metadata: { name, amountCents: rule.amountCents, trigger, templateId },
  });
  revalidatePath(`/admin/studies/${studyId}/payments`);
}

export async function actTogglePaymentRule(ruleId: string) {
  const role = await requireStaff();
  const rule = await prisma.paymentRule.findUniqueOrThrow({
    where: { id: ruleId },
  });
  const next = !rule.active;
  await prisma.paymentRule.update({
    where: { id: rule.id },
    data: { active: next },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: next ? "PAYMENT_RULE_ENABLED" : "PAYMENT_RULE_DISABLED",
    targetType: "PaymentRule",
    targetId: rule.id,
    studyId: rule.studyId,
  });
  revalidatePath(`/admin/studies/${rule.studyId}/payments`);
}

export async function actVoidPayment(eventId: string) {
  const role = await requireStaff();
  const ev = await prisma.paymentEvent.findUniqueOrThrow({
    where: { id: eventId },
    include: { rule: true },
  });
  if (ev.status === "VOIDED" || ev.status === "SETTLED") return;
  const now = await getSimNow();
  await prisma.paymentEvent.update({
    where: { id: ev.id },
    data: { status: "VOIDED", failureReason: "manual_void", settledAt: now },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "PAYMENT_VOIDED",
    targetType: "PaymentEvent",
    targetId: ev.id,
    studyId: ev.rule.studyId,
  });
  revalidatePath(`/admin/studies/${ev.rule.studyId}/payments`);
}

export async function actAddBudgetLine(formData: FormData) {
  const role = await requireStaff();
  const studyId = formData.get("studyId") as string;
  const category = (formData.get("category") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const amountDollars = parseFloat(
    (formData.get("amountDollars") as string) || "0",
  );
  if (!studyId || !category || amountDollars <= 0) {
    throw new Error("Study, category, and positive amount required");
  }
  const line = await prisma.budgetLine.create({
    data: {
      studyId,
      category,
      description,
      plannedCents: Math.round(amountDollars * 100),
    },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "BUDGET_LINE_ADDED",
    targetType: "BudgetLine",
    targetId: line.id,
    studyId,
    metadata: { category, plannedCents: line.plannedCents },
  });
  revalidatePath(`/admin/studies/${studyId}/budget`);
  redirect(`/admin/studies/${studyId}/budget`);
}
