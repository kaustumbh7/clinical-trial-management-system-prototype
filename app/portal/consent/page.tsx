import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/auth/role";
import { Button } from "@/components/ui/Button";
import { actSignConsent } from "@/app/actions/consent";

export default async function ConsentPage() {
  const role = await getRole();
  if (role.kind !== "PARTICIPANT") redirect("/");

  const participant = await prisma.participant.findUnique({
    where: { id: role.participantId },
    include: { study: true, consents: true },
  });
  if (!participant) redirect("/");
  if (participant.consents.length > 0) redirect("/portal");

  return (
    <div className="space-y-6">
      <Link
        href="/portal"
        className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back
      </Link>

      <div>
        <p className="text-[12px] text-[var(--color-muted)]">
          Informed consent
        </p>
        <h1 className="mt-1 font-display text-[30px] leading-tight tracking-tight">
          The fine print, <span className="serif-italic">briefly</span>.
        </h1>
      </div>

      <article className="rounded-lg bg-[var(--color-surface)] px-5 py-5 ring-subtle text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
        <p>
          You are being asked to participate in{" "}
          <strong className="text-[var(--color-ink)]">
            {participant.study.name}
          </strong>{" "}
          (study code{" "}
          <span className="font-mono text-[12px]">
            {participant.study.code}
          </span>
          ).
        </p>
        <p className="mt-3">
          Over the next 28 days you'll be asked to apply the study product
          daily and complete short surveys at Day 0, Day 7, Day 14, and Day 28.
          You may also be asked to upload standardized photos of the application
          area. A final 30-minute wrap-up call closes the study.
        </p>
        <p className="mt-3">
          Your data is stored encrypted, isolated by study, and accessible only
          to QuidoLabs staff with a research need. You can withdraw at any time
          without giving a reason, and we'll delete your identifiable data on
          request.
        </p>
        <p className="mt-3 text-[11.5px] text-[var(--color-muted)]">
          IRB version v1.0 · This is a prototype document. In the real
          platform, the IRB-approved consent PDF is rendered here.
        </p>
      </article>

      <form action={actSignConsent} className="space-y-4">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Type your full name
          </span>
          <input
            name="signatureName"
            required
            defaultValue={participant.name}
            className="mt-1.5 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 font-display text-[20px] text-[var(--color-primary-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
          />
        </label>
        <label className="flex items-start gap-3 rounded-lg bg-[var(--color-surface-2)] px-3.5 py-3 ring-subtle">
          <input
            type="checkbox"
            name="agree"
            required
            className="mt-0.5 accent-[var(--color-primary)]"
          />
          <span className="text-[13px] leading-relaxed">
            I have read the consent above, I understand my participation is
            voluntary, and I agree to enroll in this study.
          </span>
        </label>
        <Button type="submit" size="lg" className="w-full">
          Sign &amp; enroll
        </Button>
        <p className="text-[11px] text-[var(--color-muted)] text-center">
          Signing here creates an immutable audit record and materialises your
          full task timeline.
        </p>
      </form>
    </div>
  );
}
