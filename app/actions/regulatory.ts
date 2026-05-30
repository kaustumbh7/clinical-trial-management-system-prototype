"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { appendAudit } from "@/lib/audit/log";
import { getRole, roleLabel } from "@/lib/auth/role";

async function requireStaff() {
  const role = await getRole();
  if (role.kind !== "STAFF") throw new Error("Staff only");
  return role;
}

/**
 * Mock document "upload" — generates a placeholder text file in
 * /public/mock-docs that the UI can link to. In production this would
 * upload to encrypted object storage with signed URIs.
 */
export async function actUploadRegulatoryDoc(formData: FormData) {
  const role = await requireStaff();
  const studyId = formData.get("studyId") as string;
  const type = (formData.get("type") as string) || "OTHER";
  const title = (formData.get("title") as string)?.trim();
  const version = (formData.get("version") as string)?.trim() || "v1.0";
  const supersedesId = (formData.get("supersedesId") as string) || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  if (!studyId || !title) throw new Error("Study and title required");

  const id = crypto.randomBytes(6).toString("hex");
  const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const relPath = `mock-docs/${studyId}-${safeTitle}-${id}.txt`;
  const absPath = path.join(process.cwd(), "public", relPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(
    absPath,
    [
      `Title:   ${title}`,
      `Type:    ${type}`,
      `Version: ${version}`,
      `Notes:   ${notes ?? "—"}`,
      "",
      "[Mock regulatory document — prototype artifact.]",
    ].join("\n"),
  );

  const doc = await prisma.regulatoryDocument.create({
    data: {
      studyId,
      type,
      title,
      version,
      supersedesId,
      filePath: relPath,
      uploadedBy: roleLabel(role),
      notes,
    },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "REG_DOC_UPLOADED",
    targetType: "RegulatoryDocument",
    targetId: doc.id,
    studyId,
    metadata: { type, version, title, supersedesId },
  });
  revalidatePath(`/admin/studies/${studyId}/regulatory`);
  redirect(`/admin/studies/${studyId}/regulatory`);
}
