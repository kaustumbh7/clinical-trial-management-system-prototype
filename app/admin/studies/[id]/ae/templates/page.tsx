import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { actUpsertAeTemplate } from "@/app/actions/ae";

export default async function AeTemplatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({
    where: { id },
    include: { aeTemplates: { orderBy: { createdAt: "desc" } } },
  });
  if (!study) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/studies/${study.id}/ae`}
          className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          ← Adverse events
        </Link>
        <h1 className="mt-2 font-display text-3xl tracking-tight">
          AE report templates
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Per-study report fields. SERIOUS-severity reports against a template
          with auto-pause halt the participant&apos;s pending stream until the
          AE is resolved.
        </p>
      </div>

      {study.aeTemplates.map((tpl) => (
        <Card key={tpl.id}>
          <CardHeader
            title={tpl.name}
            hint={`${tpl.active ? "Active" : "Disabled"} · auto-pause: ${tpl.autoStreamPause ? "yes" : "no"}`}
          />
          <form
            action={actUpsertAeTemplate}
            className="grid gap-3 px-5 pb-5 sm:grid-cols-2"
          >
            <input type="hidden" name="studyId" value={study.id} />
            <input type="hidden" name="templateId" value={tpl.id} />
            <label className="text-[12px] text-[var(--color-muted)]">
              Name
              <input
                name="name"
                defaultValue={tpl.name}
                className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
              />
            </label>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                name="autoStreamPause"
                defaultChecked={tpl.autoStreamPause}
                className="accent-[var(--color-primary)]"
              />
              Auto-pause stream on SERIOUS
            </label>
            <label className="sm:col-span-2 text-[12px] text-[var(--color-muted)]">
              Fields (JSON)
              <textarea
                name="fields"
                rows={5}
                defaultValue={tpl.fields}
                className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 font-mono text-[12px]"
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm">
                Save changes
              </Button>
            </div>
          </form>
        </Card>
      ))}

      <Card variant="warm">
        <CardHeader title="Add a new template" />
        <form
          action={actUpsertAeTemplate}
          className="grid gap-3 px-5 pb-5 sm:grid-cols-2"
        >
          <input type="hidden" name="studyId" value={study.id} />
          <label className="text-[12px] text-[var(--color-muted)]">
            Name
            <input
              name="name"
              required
              placeholder="e.g. Skin irritation report v2"
              className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
            />
          </label>
          <label className="flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              name="autoStreamPause"
              defaultChecked
              className="accent-[var(--color-primary)]"
            />
            Auto-pause stream on SERIOUS
          </label>
          <label className="sm:col-span-2 text-[12px] text-[var(--color-muted)]">
            Fields (JSON)
            <textarea
              name="fields"
              rows={5}
              defaultValue={defaultFieldsJson}
              className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 font-mono text-[12px]"
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm">
              Create template
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

const defaultFieldsJson = JSON.stringify(
  [
    { key: "onset", label: "When did it start?", type: "text" },
    {
      key: "symptoms",
      label: "What are you experiencing?",
      type: "select",
      options: ["Itching", "Redness", "Burning", "Rash", "Other"],
    },
  ],
  null,
  2,
);
