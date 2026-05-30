import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { actUpsertMessageTemplate } from "@/app/actions/communications";

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({
    where: { id },
    include: {
      messageTemplates: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!study) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/studies/${study.id}/communications`}
          className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          ← Communications
        </Link>
        <h1 className="mt-2 font-display text-3xl tracking-tight">
          Message templates
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Variable substitution uses{" "}
          <code className="font-mono text-[12px]">{"{{name}}"}</code>. Engine
          reminders fall back to a built-in body if no template named
          &quot;Reminder…&quot; is active.
        </p>
      </div>

      {study.messageTemplates.map((tpl) => (
        <Card key={tpl.id}>
          <CardHeader
            title={
              <span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-muted)] mr-2">
                  {tpl.channel}
                </span>
                {tpl.name}
              </span>
            }
            hint={tpl.active ? "Active" : "Disabled"}
          />
          <form
            action={actUpsertMessageTemplate}
            className="grid gap-3 px-5 pb-5"
          >
            <input type="hidden" name="studyId" value={study.id} />
            <input type="hidden" name="templateId" value={tpl.id} />
            <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
              <select
                name="channel"
                defaultValue={tpl.channel}
                className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
              >
                <option value="EMAIL">EMAIL</option>
                <option value="SMS">SMS</option>
              </select>
              <input
                name="name"
                defaultValue={tpl.name}
                className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
              />
            </div>
            {tpl.channel === "EMAIL" && (
              <input
                name="subject"
                defaultValue={tpl.subject ?? ""}
                placeholder="Subject"
                className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
              />
            )}
            <textarea
              name="body"
              rows={5}
              defaultValue={tpl.body}
              className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
            />
            <Button type="submit" size="sm" variant="secondary">
              Save
            </Button>
          </form>
        </Card>
      ))}

      <Card variant="warm">
        <CardHeader title="Add a new template" />
        <form action={actUpsertMessageTemplate} className="grid gap-3 px-5 pb-5">
          <input type="hidden" name="studyId" value={study.id} />
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <select
              name="channel"
              defaultValue="EMAIL"
              className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
            >
              <option value="EMAIL">EMAIL</option>
              <option value="SMS">SMS</option>
            </select>
            <input
              name="name"
              required
              placeholder="Template name"
              className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
            />
          </div>
          <input
            name="subject"
            placeholder="Subject (email only)"
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          />
          <textarea
            name="body"
            required
            rows={5}
            placeholder={`Hi {{participant_first}}, just a reminder that "{{task_name}}" is due {{due_date}}.`}
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          />
          <Button type="submit" size="sm">
            Create template
          </Button>
        </form>
      </Card>
    </div>
  );
}
