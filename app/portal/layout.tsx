import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/auth/role";
import { Logo } from "@/components/ui/Logo";
import { RoleSwitcher } from "@/components/RoleSwitcher";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getRole();
  if (role.kind !== "PARTICIPANT") {
    redirect("/");
  }
  const participant = await prisma.participant.findUnique({
    where: { id: role.participantId },
    include: { study: true },
  });
  if (!participant) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-5 py-3.5">
          <Link href="/portal" className="-ml-1">
            <Logo size={18} />
          </Link>
          <RoleSwitcher />
        </div>
        <nav className="mx-auto flex max-w-md gap-1 px-5 pb-2 text-[11px]">
          <Link
            href="/portal"
            className="rounded-md px-2 py-1 text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)]"
          >
            Tasks
          </Link>
          <Link
            href="/portal/appointments"
            className="rounded-md px-2 py-1 text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)]"
          >
            Visits
          </Link>
          <Link
            href="/portal/payments"
            className="rounded-md px-2 py-1 text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)]"
          >
            Earnings
          </Link>
          <Link
            href="/portal/ae/new"
            className="ml-auto rounded-md px-2 py-1 text-[var(--color-status-overdue)] hover:bg-[var(--color-status-overdue-soft)]"
          >
            Report a problem
          </Link>
        </nav>
      </header>
      <div className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:py-8">
        <div className="mb-5 rounded-lg bg-[var(--color-surface-2)] px-4 py-3 ring-subtle">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
            You're in
          </div>
          <div className="mt-0.5 font-display text-[18px] leading-tight">
            {participant.study.name}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-[var(--color-muted)]">
            {participant.study.code}
          </div>
        </div>
        {children}
      </div>
      <footer className="border-t border-[var(--color-border)] px-5 py-4 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
          Need help? Message your coordinator
        </p>
      </footer>
    </div>
  );
}
