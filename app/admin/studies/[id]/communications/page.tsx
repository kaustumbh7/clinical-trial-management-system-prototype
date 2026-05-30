import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { actSendManualMessage } from "@/app/actions/communications";

const STATUS_STYLES: Record<string, string> = {
  QUEUED: "bg-[var(--color-status-pending-soft)] text-[var(--color-status-pending)]",
  SENT: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
  DELIVERED:
    "bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]",
  BOUNCED:
    "bg-[var(--color-status-overdue-soft)] text-[var(--color-status-overdue)]",
  FAILED:
    "bg-[var(--color-status-overdue-soft)] text-[var(--color-status-overdue)]",
};

export default async function CommunicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({
    where: { id },
    include: {
      participants: {
        where: { status: { in: ["ENROLLED", "CONSENTED", "COMPLETED"] } },
        orderBy: { name: "asc" },
      },
      messageTemplates: { where: { active: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!study) notFound();

  const messages = await prisma.message.findMany({
    where: { studyId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { participant: true, template: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <Link
            href={`/admin/studies/${study.id}`}
            className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            ← {study.code}
          </Link>
          <h1 className="mt-2 font-display text-3xl tracking-tight">
            Communications
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            Outbound message history. Automated reminders write here too —
            every send is a Message row, every delivery confirmation a webhook.
          </p>
        </div>
        <Button
          href={`/admin/studies/${study.id}/communications/templates`}
          variant="secondary"
        >
          Templates →
        </Button>
      </div>

      <Card variant="warm">
        <CardHeader title="Send a manual message" />
        <form
          action={actSendManualMessage}
          className="grid gap-2 px-5 pb-5 sm:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <input type="hidden" name="studyId" value={study.id} />
          <select
            name="participantId"
            required
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          >
            <option value="">Choose participant…</option>
            {study.participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            name="channel"
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          >
            <option value="EMAIL">EMAIL</option>
            <option value="SMS">SMS</option>
          </select>
          <select
            name="templateId"
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          >
            <option value="">Choose a template…</option>
            {study.messageTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.channel})
              </option>
            ))}
          </select>
          <Button type="submit" size="sm">
            Send
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title={`${messages.length} message(s)`} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[11px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
              <tr className="border-y border-[var(--color-border)]">
                <th className="px-5 py-3 font-medium">When</th>
                <th className="px-5 py-3 font-medium">Channel</th>
                <th className="px-5 py-3 font-medium">To</th>
                <th className="px-5 py-3 font-medium">Subject / preview</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {messages.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-[var(--color-muted)]"
                  >
                    No messages yet. Advance the sim clock to trigger a
                    reminder, or send a manual message above.
                  </td>
                </tr>
              )}
              {messages.map((m) => (
                <tr key={m.id} className="hover:bg-[var(--color-surface-2)]">
                  <td className="px-5 py-2.5 font-mono text-[11px] text-[var(--color-muted)]">
                    {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-5 py-2.5 font-mono text-[11.5px]">
                    {m.channel}
                  </td>
                  <td className="px-5 py-2.5 text-[12.5px]">
                    {m.participant?.name ? (
                      <>
                        {m.participant.name}
                        <span className="ml-1 text-[10.5px] text-[var(--color-muted)] font-mono">
                          {m.toAddress}
                        </span>
                      </>
                    ) : (
                      <span className="font-mono text-[12px]">{m.toAddress}</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 max-w-md">
                    {m.subject && (
                      <div className="text-[12.5px] font-medium truncate">
                        {m.subject}
                      </div>
                    )}
                    <div className="text-[11.5px] text-[var(--color-muted)] truncate">
                      {m.body}
                    </div>
                  </td>
                  <td className="px-5 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                        STATUS_STYLES[m.status]
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
