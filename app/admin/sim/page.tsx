import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getSimNow } from "@/lib/sim-clock";
import { actAdvanceSim, actFireWebhook } from "@/app/actions/sim";

export default async function SimulatorPage() {
  const simNow = await getSimNow();

  const [pending, due, overdue, completed, audit] = await Promise.all([
    prisma.taskInstance.count({ where: { status: "PENDING" } }),
    prisma.taskInstance.count({ where: { status: "DUE" } }),
    prisma.taskInstance.count({ where: { status: "OVERDUE" } }),
    prisma.taskInstance.count({ where: { status: "COMPLETED" } }),
    prisma.auditEvent.findMany({
      orderBy: { ts: "desc" },
      take: 10,
      where: {
        action: {
          in: [
            "CLOCK_TICK",
            "TASK_BECAME_DUE",
            "TASK_OVERDUE",
            "REMINDER_SENT",
            "WEBHOOK_RECEIVED",
            "SIM_CLOCK_ADVANCED",
          ],
        },
      },
    }),
  ]);

  const advance1Day = async () => {
    "use server";
    await actAdvanceSim(1);
  };
  const advance7Days = async () => {
    "use server";
    await actAdvanceSim(7);
  };
  const advance14Days = async () => {
    "use server";
    await actAdvanceSim(14);
  };
  const fireEmail = async () => {
    "use server";
    await actFireWebhook("sendgrid", "email.delivered", {
      messageId: `mock-${Date.now()}`,
    });
  };
  const fireSms = async () => {
    "use server";
    await actFireWebhook("twilio", "sms.delivered", {
      messageSid: `SM${Date.now()}`,
    });
  };
  const fireBounce = async () => {
    "use server";
    await actFireWebhook("sendgrid", "email.bounced", {
      messageId: `mock-${Date.now()}`,
      reason: "mailbox_full",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Demo controls
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">Simulator</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-[var(--color-muted)]">
          Advance the simulated clock and fire vendor webhooks to see the SOE
          engine react. In production: a real cron + real signed webhooks call
          the same engine code paths.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card variant="primary">
          <CardHeader
            title="Simulated clock"
            hint={`Current sim date: ${simNow.toISOString().slice(0, 10)}`}
          />
          <div className="space-y-3 px-5 pb-5">
            <div className="rounded-lg bg-[var(--color-surface)] px-4 py-4 text-center">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
                Now
              </div>
              <div className="mt-1 font-display text-3xl tracking-tight tabular">
                {simNow.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <form action={advance1Day}>
                <Button type="submit" variant="secondary" className="w-full">
                  +1 day
                </Button>
              </form>
              <form action={advance7Days}>
                <Button type="submit" className="w-full">
                  +7 days
                </Button>
              </form>
              <form action={advance14Days}>
                <Button type="submit" variant="secondary" className="w-full">
                  +14 days
                </Button>
              </form>
            </div>
            <p className="text-[11px] text-[var(--color-muted)]">
              Advancing time fires <code className="font-mono">CLOCK_TICK</code>{" "}
              into the engine. Tasks transition PENDING → DUE → OVERDUE.
              Reminders fire on their offset.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Simulate vendor webhooks" />
          <div className="space-y-2 px-5 pb-5">
            <WebhookRow
              vendor="SendGrid"
              type="email.delivered"
              action={fireEmail}
              variant="primary"
            />
            <WebhookRow
              vendor="Twilio"
              type="sms.delivered"
              action={fireSms}
              variant="primary"
            />
            <WebhookRow
              vendor="SendGrid"
              type="email.bounced"
              action={fireBounce}
              variant="danger"
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Stat label="Pending" value={pending} accent="pending" />
        <Stat label="Due" value={due} accent="due" />
        <Stat label="Overdue" value={overdue} accent="overdue" />
        <Stat label="Completed" value={completed} accent="completed" />
      </div>

      <Card>
        <CardHeader
          title="Engine activity"
          hint="Most recent transitions, reminders, and webhook receipts."
        />
        <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)] text-[12.5px]">
          {audit.length === 0 && (
            <li className="px-5 py-10 text-center text-[var(--color-muted)]">
              No engine events yet. Advance time to start.
            </li>
          )}
          {audit.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
              <span className="font-mono text-[11px] text-[var(--color-muted)] whitespace-nowrap">
                {a.ts.toISOString().slice(11, 19)}
              </span>
              <span className="font-mono text-[11.5px]">{a.action}</span>
              <span className="text-[11px] text-[var(--color-muted)]">
                {a.actorLabel ?? a.actorKind.toLowerCase()}
              </span>
              {a.metadata && (
                <code className="ml-auto truncate text-[10.5px] font-mono text-[var(--color-muted)]">
                  {a.metadata}
                </code>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function WebhookRow({
  vendor,
  type,
  action,
  variant,
}: {
  vendor: string;
  type: string;
  action: () => void;
  variant: "primary" | "secondary" | "danger";
}) {
  return (
    <form
      action={action}
      className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
    >
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
          {vendor}
        </div>
        <div className="font-mono text-[12.5px]">{type}</div>
      </div>
      <Button type="submit" size="sm" variant={variant}>
        Fire →
      </Button>
    </form>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "pending" | "due" | "overdue" | "completed";
}) {
  return (
    <div className="ring-subtle rounded-lg bg-[var(--color-surface)] px-5 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-4xl tracking-tight tabular text-[var(--color-status-${accent})]`}
      >
        {value}
      </div>
    </div>
  );
}
