import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth/role";
import { prisma } from "@/lib/db";
import { Logo } from "@/components/ui/Logo";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { getSimNow } from "@/lib/sim-clock";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getRole();
  if (role.kind !== "STAFF") {
    redirect("/");
  }

  const [studies, simNow] = await Promise.all([
    prisma.study.findMany({ orderBy: { createdAt: "asc" } }),
    getSimNow(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-6 py-3">
          <Logo />
          <span className="hidden md:inline-block h-4 w-px bg-[var(--color-border-strong)]" />
          <nav className="hidden md:flex items-center gap-1 text-[13px]">
            <NavLink href="/admin">Dashboard</NavLink>
            <NavLink href="/admin/audit">Audit log</NavLink>
            <NavLink href="/admin/sim">Simulator</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <SimNowPill date={simNow} />
            <RoleSwitcher />
          </div>
        </div>
        {studies.length > 0 && (
          <div className="mx-auto flex max-w-[1400px] items-center gap-1 overflow-x-auto px-6 pb-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted)] mr-2">
              Studies
            </span>
            {studies.map((s) => (
              <Link
                key={s.id}
                href={`/admin/studies/${s.id}`}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[12px] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              >
                <span className="font-mono text-[10px] text-[var(--color-muted)]">
                  {s.code}
                </span>
                <span className="mx-1.5 text-[var(--color-border-strong)]">·</span>
                {s.name.length > 38 ? s.name.slice(0, 38) + "…" : s.name}
              </Link>
            ))}
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-2.5 py-1.5 text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
    >
      {children}
    </Link>
  );
}

function SimNowPill({ date }: { date: Date }) {
  const formatted = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[11px]">
      <span className="size-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
      <span className="uppercase tracking-[0.15em] text-[var(--color-muted)]">
        Sim date
      </span>
      <span className="tabular font-mono">{formatted}</span>
    </span>
  );
}
