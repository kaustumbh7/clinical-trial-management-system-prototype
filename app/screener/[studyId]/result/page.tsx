import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Logo } from "@/components/ui/Logo";

const COPY: Record<
  "DISQUALIFIED" | "WAITLIST",
  { headline: string; body: string; tone: "warn" | "info" }
> = {
  DISQUALIFIED: {
    headline: "Not a match this time.",
    body: "Based on your answers you're not eligible for this study. Thank you for your interest — we'll let you know if a more suitable study opens up.",
    tone: "warn",
  },
  WAITLIST: {
    headline: "You're on the waitlist.",
    body: "All study arms are currently at capacity. We'll email you the moment a spot opens up and you can pick up where you left off.",
    tone: "info",
  },
};

export default async function ScreenerResult({
  params,
  searchParams,
}: {
  params: Promise<{ studyId: string }>;
  searchParams: Promise<{ o?: string }>;
}) {
  const { studyId } = await params;
  const { o } = await searchParams;
  const study = await prisma.study.findUnique({ where: { id: studyId } });
  if (!study) notFound();

  const outcomeKey = (o === "WAITLIST" ? "WAITLIST" : "DISQUALIFIED") as
    | "DISQUALIFIED"
    | "WAITLIST";
  const copy = COPY[outcomeKey];

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-xl items-center justify-between px-6 py-4">
          <Logo />
          <Link
            href="/"
            className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            ← Landing
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <span
          className={`inline-block rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em] ${
            copy.tone === "warn"
              ? "bg-[var(--color-status-overdue-soft)] text-[var(--color-status-overdue)]"
              : "bg-[var(--color-status-pending-soft)] text-[var(--color-status-pending)]"
          }`}
        >
          {outcomeKey}
        </span>
        <h1 className="mt-5 font-display text-5xl leading-tight tracking-tight">
          {copy.headline}
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          {copy.body}
        </p>
        <div className="mt-10">
          <Link
            href="/"
            className="text-[12px] uppercase tracking-[0.18em] text-[var(--color-primary)]"
          >
            ← Back to landing
          </Link>
        </div>
      </div>
    </main>
  );
}
