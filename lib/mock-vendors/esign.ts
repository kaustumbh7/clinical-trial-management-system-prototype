import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Mock e-signature vendor. In production this would be DocuSign or Dropbox
 * Sign called through an `ESignAdapter`. For the prototype we generate a
 * placeholder "signed document" as a plain text file in /public/mock-pdfs.
 * The internal contract — signed artifact stored at a stable path, signing
 * metadata captured — is the same shape the real adapter would return.
 */
export async function generateSignedConsent(input: {
  participantId: string;
  participantName: string;
  studyCode: string;
  signatureName: string;
  signedAt: Date;
}) {
  const id = crypto.randomBytes(8).toString("hex");
  const relPath = `mock-pdfs/consent-${input.participantId}-${id}.txt`;
  const absPath = path.join(process.cwd(), "public", relPath);

  await fs.mkdir(path.dirname(absPath), { recursive: true });

  const contents = [
    "═══════════════════════════════════════════════════════════════",
    `  INFORMED CONSENT — ${input.studyCode}`,
    "═══════════════════════════════════════════════════════════════",
    "",
    `Participant: ${input.participantName} (${input.participantId})`,
    `Signed at:   ${input.signedAt.toISOString()}`,
    `Typed name:  ${input.signatureName}`,
    "",
    "The participant has reviewed and agreed to the IRB-approved",
    "informed consent (version v1.0).",
    "",
    `Mock signature hash: ${crypto.createHash("sha256").update(input.signatureName + input.signedAt.toISOString()).digest("hex").slice(0, 32)}`,
    "",
    "[This is a PROTOTYPE artifact — not a real e-signature.]",
  ].join("\n");

  await fs.writeFile(absPath, contents, "utf8");
  return { relPath, absPath };
}
