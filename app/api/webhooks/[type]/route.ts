import { NextRequest, NextResponse } from "next/server";
import { handleEvent } from "@/lib/soe/engine";

/**
 * Mock vendor webhook intake. In production this would verify a signature
 * (e.g. Stripe-Signature, X-Twilio-Signature) before forwarding the event
 * to the engine. The intake → engine boundary matches the prod design.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
) {
  const { type } = await ctx.params;
  const url = new URL(req.url);
  const vendor = url.searchParams.get("vendor") ?? "unknown";
  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  await handleEvent({ kind: "WEBHOOK_RECEIVED", vendor, type, payload });
  return NextResponse.json({ ok: true });
}
