import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Mock shipping vendor. In production this would talk to the FedEx/UPS API
 * via a `ShippingAdapter`. For the prototype we generate a deterministic
 * tracking number and write a placeholder "label" file to /public/mock-labels.
 *
 * The internal contract (label path + tracking number returned, status driven
 * by webhooks) matches what the real adapter exposes — so swapping in a real
 * carrier is a new adapter, nothing else.
 */
export async function createShipmentLabel(input: {
  kitId: string;
  toName: string;
  toAddressLine: string;
  direction: "OUTBOUND" | "RETURN";
}) {
  const carrier = pickCarrier();
  const trackingNumber = generateTrackingNumber(carrier);
  const labelId = crypto.randomBytes(6).toString("hex");
  const relPath = `mock-labels/${input.direction.toLowerCase()}-${input.kitId}-${labelId}.txt`;
  const absPath = path.join(process.cwd(), "public", relPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });

  const contents = [
    "═══════════════════════════════════════════════════════════════",
    `  ${carrier.toUpperCase()} — ${input.direction} SHIPMENT LABEL`,
    "═══════════════════════════════════════════════════════════════",
    "",
    `Tracking #:  ${trackingNumber}`,
    `Kit:         ${input.kitId}`,
    `To:          ${input.toName}`,
    `             ${input.toAddressLine}`,
    "",
    "[Mock label — prototype only.]",
  ].join("\n");
  await fs.writeFile(absPath, contents, "utf8");

  return { carrier, trackingNumber, labelPath: relPath };
}

function pickCarrier(): "FedEx" | "UPS" | "USPS" {
  const carriers = ["FedEx", "UPS", "USPS"] as const;
  return carriers[Math.floor(Math.random() * carriers.length)];
}

function generateTrackingNumber(carrier: string): string {
  const num = crypto.randomBytes(6).toString("hex").toUpperCase();
  const prefix =
    carrier === "FedEx" ? "FX" : carrier === "UPS" ? "1Z" : "9400";
  return `${prefix}${num}`;
}
