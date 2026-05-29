import Link from "next/link";
import { prisma } from "@/lib/db";
import { actAssumeRole } from "./actions/role";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

export default async function LandingPage() {
  const [study, leadParticipant, screenedParticipant] = await Promise.all([
    prisma.study.findFirst({ orderBy: { createdAt: "asc" } }),
    prisma.participant.findFirst({
      where: { status: "LEAD" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.participant.findFirst({
      where: { status: { in: ["SCREENED", "CONSENTED", "ENROLLED"] } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const enterAsPI = async () => {
    "use server";
    await actAssumeRole(
      { kind: "STAFF", role: "PI", name: "Dr. Luma Reyes" },
      "/admin",
    );
  };
  const enterAsCoordinator = async () => {
    "use server";
    await actAssumeRole(
      { kind: "STAFF", role: "COORDINATOR", name: "Sam Okafor" },
      "/admin",
    );
  };
  const enterAsParticipant = async () => {
    "use server";
    const p = screenedParticipant ?? leadParticipant;
    if (!p) return;
    await actAssumeRole(
      { kind: "PARTICIPANT", participantId: p.id, name: p.name },
      "/portal",
    );
  };

  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-border-strong)] to-transparent" />

      <header className="relative flex items-center justify-between px-6 py-5 sm:px-12 sm:py-8">
        <Logo />
        <Link
          href={study ? `/screener/${study.id}` : "#"}
          className="text-[12px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          Join a study →
        </Link>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pt-8 pb-24 sm:px-12 sm:pt-16">
        <div className="max-w-3xl">
          <span className="inline-block rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
            Prototype · HIPAA-ready architecture
          </span>
          <h1 className="mt-6 font-display text-5xl leading-[1.05] tracking-tight text-[var(--color-ink)] sm:text-7xl">
            The clinical trial<br />
            <span className="serif-italic text-[var(--color-primary)]">runs itself</span>
            <span className="serif-italic text-[var(--color-ink-2)]">.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-[var(--color-ink-2)]">
            A modular Clinical Trial Management System built around a single idea:
            the Schedule of Events is the event spine. Every other module either
            feeds it, or reacts to it — and the participant journey runs end-to-end
            without manual hand-off.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          <RoleCard
            onSelect={enterAsPI}
            tag="Staff"
            title="Principal Investigator"
            subtitle="Dr. Luma Reyes"
            description="Full study control, audit visibility, simulator access."
            primary
          />
          <RoleCard
            onSelect={enterAsCoordinator}
            tag="Staff"
            title="Coordinator"
            subtitle="Sam Okafor"
            description="Participant operations, manual overrides, reporting."
          />
          <RoleCard
            onSelect={enterAsParticipant}
            tag="Participant"
            title={screenedParticipant?.name ?? leadParticipant?.name ?? "—"}
            subtitle={
              screenedParticipant
                ? "Screened — needs consent"
                : leadParticipant
                ? "Lead — fresh recruit"
                : "No participants seeded"
            }
            description="Mobile-first task timeline, consent, and study activities."
            disabled={!leadParticipant && !screenedParticipant}
          />
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
              Demo path
            </p>
            <p className="mt-2 text-[14px] text-[var(--color-ink-2)]">
              <span className="font-display text-[18px] text-[var(--color-ink)]">1.</span>{" "}
              Join the study via the public screener.{" "}
              <span className="font-display text-[18px] text-[var(--color-ink)]">2.</span>{" "}
              Sign consent. The SOE materialises the timeline.{" "}
              <span className="font-display text-[18px] text-[var(--color-ink)]">3.</span>{" "}
              Advance the sim clock from the Admin panel and watch tasks transition.
            </p>
          </div>
          <div className="flex gap-3">
            {study && (
              <>
                <Button href={`/screener/${study.id}`} variant="secondary">
                  Public screener
                </Button>
                <Button href="/admin">Enter admin →</Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-24 grid gap-12 border-t border-[var(--color-border)] pt-12 sm:grid-cols-3">
          <Pillar
            number="01"
            title="SOE engine"
            body="A deterministic state machine — every trigger (task, clock, webhook, override) routes through one entry point."
          />
          <Pillar
            number="02"
            title="Append-only audit"
            body="Every PHI write is logged with actor, action, target, and metadata. No update or delete paths exist in the writer."
          />
          <Pillar
            number="03"
            title="Study isolation"
            body="Every PHI-bearing row carries study_id. In production: enforced by row-level security in Postgres."
          />
        </div>
      </section>

      <footer className="relative border-t border-[var(--color-border)] px-6 py-6 sm:px-12">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
          <span>Prototype with mock data · No real PHI</span>
          <span className="mx-2">·</span>
          <span>Based on the contractor proposal · v1.0</span>
        </p>
      </footer>
    </main>
  );
}

function RoleCard({
  tag,
  title,
  subtitle,
  description,
  onSelect,
  primary,
  disabled,
}: {
  tag: string;
  title: string;
  subtitle: string;
  description: string;
  onSelect: () => void | Promise<void>;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <form action={onSelect}>
      <button
        type="submit"
        disabled={disabled}
        className={`group relative w-full text-left rounded-xl ring-subtle p-6 transition-all ${
          primary
            ? "bg-[var(--color-ink)] text-[var(--color-bg)]"
            : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]"
        } hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:pointer-events-none`}
      >
        <span
          className={`text-[10px] uppercase tracking-[0.22em] ${
            primary ? "text-[var(--color-bg)]/60" : "text-[var(--color-muted)]"
          }`}
        >
          {tag}
        </span>
        <div className="mt-3 font-display text-2xl tracking-tight">{title}</div>
        <div
          className={`mt-1 text-[13px] ${
            primary ? "text-[var(--color-bg)]/70" : "text-[var(--color-muted)]"
          }`}
        >
          {subtitle}
        </div>
        <p
          className={`mt-6 text-[13px] leading-relaxed ${
            primary ? "text-[var(--color-bg)]/80" : "text-[var(--color-ink-2)]"
          }`}
        >
          {description}
        </p>
        <div
          className={`mt-8 inline-flex items-center gap-2 text-[12px] tracking-wide ${
            primary ? "text-[var(--color-bg)]" : "text-[var(--color-primary)]"
          }`}
        >
          Continue
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </div>
      </button>
    </form>
  );
}

function Pillar({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="font-display text-3xl text-[var(--color-primary)]">
        {number}
      </div>
      <div className="mt-3 text-[15px] font-medium">{title}</div>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
        {body}
      </p>
    </div>
  );
}
