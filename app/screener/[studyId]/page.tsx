import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { actSubmitScreener } from "@/app/actions/screener";

export default async function ScreenerPage({
  params,
  searchParams,
}: {
  params: Promise<{ studyId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { studyId } = await params;
  const { error } = await searchParams;
  const study = await prisma.study.findUnique({ where: { id: studyId } });
  if (!study) notFound();

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Logo />
          <Link
            href="/"
            className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            ← Landing
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <span className="inline-block rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Public screener · {study.code}
        </span>
        <h1 className="mt-5 font-display text-5xl leading-[1.05] tracking-tight">
          Want to join<br />
          <span className="serif-italic text-[var(--color-primary)]">{study.name.split("—")[0].trim()}</span>?
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          A few quick questions tell us whether you're eligible. Takes about 90
          seconds — no PHI required up front.
        </p>

        {error && (
          <div className="mt-6 rounded-lg bg-[var(--color-status-overdue-soft)] px-4 py-3 text-[13px] text-[var(--color-status-overdue)]">
            Please complete every question to continue.
          </div>
        )}

        <form
          action={actSubmitScreener}
          className="mt-10 space-y-7 rounded-2xl bg-[var(--color-surface)] px-6 py-7 ring-subtle"
        >
          <input type="hidden" name="studyId" value={study.id} />
          <Field label="Your name" name="name" placeholder="Casey Morgan" required />
          <Field
            label="Email"
            name="email"
            type="email"
            placeholder="casey@example.com"
            required
          />
          <Field
            label="Age"
            name="age"
            type="number"
            placeholder="e.g. 32"
            inputMode="numeric"
            required
          />
          <RadioGroup
            label="Do you live in the United States?"
            name="livesInUS"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
          <RadioGroup
            label="Do you use deodorant daily?"
            name="usesDeodorantDaily"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
          <RadioGroup
            label="Would you describe your skin as sensitive?"
            name="sensitiveSkin"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "unsure", label: "Unsure" },
            ]}
          />
          <RadioGroup
            label="Do you have any known allergies to deodorant ingredients?"
            name="hasKnownAllergy"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />

          <Button type="submit" size="lg" className="w-full">
            Check my eligibility
          </Button>
          <p className="text-center text-[11px] text-[var(--color-muted)]">
            By continuing, you agree to share this information with TaxaTech so
            we can determine your eligibility.
          </p>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
        {label}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-1.5 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
      />
    </label>
  );
}

function RadioGroup({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <fieldset>
      <legend className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
        {label}
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="cursor-pointer rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-[13px] has-checked:border-[var(--color-primary)] has-checked:bg-[var(--color-primary-soft)] has-checked:text-[var(--color-primary-ink)]"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              required
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
