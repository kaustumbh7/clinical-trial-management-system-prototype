import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { actUploadRegulatoryDoc } from "@/app/actions/regulatory";

const TYPE_STYLES: Record<string, string> = {
  IRB: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
  PROTOCOL: "bg-[var(--color-status-pending-soft)] text-[var(--color-status-pending)]",
  CONSENT_TEMPLATE:
    "bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]",
  SOP: "bg-[var(--color-surface-2)] text-[var(--color-ink-2)]",
  OTHER: "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
};

export default async function RegulatoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({
    where: { id },
    include: {
      regDocs: { orderBy: { uploadedAt: "desc" } },
    },
  });
  if (!study) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/studies/${study.id}`}
          className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          ← {study.code}
        </Link>
        <h1 className="mt-2 font-display text-3xl tracking-tight">
          Regulatory documents
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Versioned repository for IRB, protocol, consent templates, SOPs, and
          other documents. New versions supersede previous; nothing is deleted.
        </p>
      </div>

      <Card variant="warm">
        <CardHeader title="Upload a new version" />
        <form
          action={actUploadRegulatoryDoc}
          className="grid gap-2 px-5 pb-5 sm:grid-cols-[auto_1fr_auto_1fr_auto]"
        >
          <input type="hidden" name="studyId" value={study.id} />
          <select
            name="type"
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          >
            <option value="IRB">IRB</option>
            <option value="PROTOCOL">PROTOCOL</option>
            <option value="CONSENT_TEMPLATE">CONSENT_TEMPLATE</option>
            <option value="SOP">SOP</option>
            <option value="OTHER">OTHER</option>
          </select>
          <input
            name="title"
            placeholder="Title"
            required
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          />
          <input
            name="version"
            placeholder="v1.1"
            defaultValue="v1.1"
            className="w-24 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 font-mono text-[13px]"
          />
          <select
            name="supersedesId"
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          >
            <option value="">Supersedes nothing</option>
            {study.regDocs.map((d) => (
              <option key={d.id} value={d.id}>
                Supersedes: {d.title} {d.version}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm">
            Upload
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title={`${study.regDocs.length} document(s)`} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[11px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
              <tr className="border-y border-[var(--color-border)]">
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Version</th>
                <th className="px-5 py-3 font-medium">Uploaded</th>
                <th className="px-5 py-3 font-medium">By</th>
                <th className="px-5 py-3 font-medium">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {study.regDocs.map((d) => (
                <tr key={d.id} className="hover:bg-[var(--color-surface-2)]">
                  <td className="px-5 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                        TYPE_STYLES[d.type] ?? ""
                      }`}
                    >
                      {d.type}
                    </span>
                  </td>
                  <td className="px-5 py-2.5">{d.title}</td>
                  <td className="px-5 py-2.5 font-mono text-[12px]">
                    {d.version}
                  </td>
                  <td className="px-5 py-2.5 font-mono text-[11.5px] text-[var(--color-muted)]">
                    {d.uploadedAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-5 py-2.5 text-[12px] text-[var(--color-muted)]">
                    {d.uploadedBy ?? "—"}
                  </td>
                  <td className="px-5 py-2.5">
                    <a
                      href={`/${d.filePath}`}
                      target="_blank"
                      className="text-[var(--color-primary)] text-[12px]"
                    >
                      Open →
                    </a>
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
