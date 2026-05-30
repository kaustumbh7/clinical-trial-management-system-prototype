import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/auth/role";

const STATUS_STYLES: Record<string, string> = {
  SENT: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
  DELIVERED:
    "bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]",
  BOUNCED:
    "bg-[var(--color-status-overdue-soft)] text-[var(--color-status-overdue)]",
};

export default async function InboxPage() {
  const role = await getRole();
  if (role.kind !== "PARTICIPANT") redirect("/");

  const messages = await prisma.message.findMany({
    where: { participantId: role.participantId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[var(--color-muted)]">Inbox</p>
        <h1 className="mt-1 font-display text-[30px] leading-tight tracking-tight">
          Messages from the study
        </h1>
      </div>

      <ul className="space-y-2">
        {messages.length === 0 && (
          <li className="rounded-lg bg-[var(--color-surface-2)] px-4 py-5 text-[13px] text-[var(--color-muted)]">
            No messages yet. Reminders appear here as the study progresses.
          </li>
        )}
        {messages.map((m) => (
          <li
            key={m.id}
            className="rounded-lg bg-[var(--color-surface)] px-4 py-3 ring-subtle"
          >
            <div className="flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
              <span className="font-mono uppercase">{m.channel}</span>
              <span>·</span>
              <span className="font-mono">
                {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </span>
              <span
                className={`ml-auto inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                  STATUS_STYLES[m.status] ?? ""
                }`}
              >
                {m.status}
              </span>
            </div>
            {m.subject && (
              <div className="mt-1 font-display text-[16px] leading-tight">
                {m.subject}
              </div>
            )}
            <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--color-ink-2)]">
              {m.body}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
