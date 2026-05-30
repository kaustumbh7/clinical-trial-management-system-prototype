import crypto from "node:crypto";

/**
 * Mock payment processor. In production this would be the Stripe SDK called
 * behind a `PaymentAdapter`. The mock returns PENDING immediately; the
 * settlement is delivered separately via a `payment.settled` webhook fired
 * from the simulator panel.
 *
 * The `processorRef` doubles as the idempotency key — same input twice
 * returns the same ref.
 */
export type ChargeRequest = {
  participantId: string;
  ruleId: string;
  amountCents: number;
  currency?: string;
  idempotencyKey?: string;
};

export type ChargeResult = {
  processorRef: string;
  status: "PENDING";
  amountCents: number;
  currency: string;
};

export async function chargeMock(input: ChargeRequest): Promise<ChargeResult> {
  const key =
    input.idempotencyKey ??
    `${input.participantId}-${input.ruleId}-${input.amountCents}`;
  const ref =
    "mck_" + crypto.createHash("sha1").update(key).digest("hex").slice(0, 20);
  return {
    processorRef: ref,
    status: "PENDING",
    amountCents: input.amountCents,
    currency: input.currency ?? "USD",
  };
}

export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
