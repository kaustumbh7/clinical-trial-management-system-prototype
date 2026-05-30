import crypto from "node:crypto";
import { prisma } from "../db";

/**
 * Mock email + SMS sender. In production, EmailAdapter (SendGrid / Postmark)
 * and SMSAdapter (Twilio) would handle delivery and return a vendorRef. The
 * webhook side later flips the Message status to DELIVERED/BOUNCED.
 *
 * Templating: simple `{{key}}` substitution against the variables map.
 */
export async function sendMessage(input: {
  studyId: string;
  participantId?: string;
  templateId?: string;
  channel: "EMAIL" | "SMS";
  toAddress: string;
  subject?: string;
  body: string;
  variables?: Record<string, string>;
  now: Date;
}) {
  const subject = applyVariables(input.subject ?? "", input.variables ?? {});
  const body = applyVariables(input.body, input.variables ?? {});
  const vendorRef =
    (input.channel === "EMAIL" ? "msg_" : "sms_") +
    crypto.randomBytes(8).toString("hex");

  const msg = await prisma.message.create({
    data: {
      studyId: input.studyId,
      participantId: input.participantId,
      templateId: input.templateId,
      channel: input.channel,
      toAddress: input.toAddress,
      subject: subject || null,
      body,
      vendorRef,
      status: "SENT",
      sentAt: input.now,
      createdAt: input.now,
    },
  });
  return msg;
}

export function applyVariables(s: string, vars: Record<string, string>) {
  return s.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? `{{${k}}}` : v;
  });
}

export async function findMessageByVendorRef(vendorRef: string) {
  return prisma.message.findUnique({ where: { vendorRef } });
}
