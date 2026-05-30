import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { actPostNote, actResolveNote } from "@/app/actions/notes";

export async function InternalNoteThread({
  targetType,
  targetId,
  revalidate,
  title = "Internal notes",
}: {
  targetType: string;
  targetId: string;
  revalidate?: string;
  title?: string;
}) {
  const [notes, staff] = await Promise.all([
    prisma.internalNote.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: "desc" },
      include: { author: true },
    }),
    prisma.staffUser.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <Card variant="warm">
      <CardHeader
        title={title}
        hint={`${notes.length} note(s) · staff-only`}
      />
      <div className="space-y-3 px-5 pb-5">
        <form
          action={actPostNote}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
        >
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          {revalidate && (
            <input type="hidden" name="revalidate" value={revalidate} />
          )}
          <textarea
            name="body"
            rows={2}
            required
            placeholder="Note for the team — @mention a coordinator if needed"
            className="w-full rounded-md bg-[var(--color-surface)] px-2 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-[10.5px] text-[var(--color-muted)]">
              Mention with{" "}
              <code className="font-mono">@firstname</code>. Staff currently in
              directory:{" "}
              <span className="font-mono">
                {staff.map((s) => s.name.split(" ")[0]).join(", ")}
              </span>
            </div>
            <Button type="submit" size="sm">
              Post
            </Button>
          </div>
        </form>

        {notes.length === 0 ? (
          <p className="text-[12px] text-[var(--color-muted)] text-center py-3">
            No notes yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => {
              const mentions = n.mentions
                ? (JSON.parse(n.mentions) as string[])
                : [];
              const mentionedStaff = mentions
                .map((id) => staff.find((s) => s.id === id))
                .filter((s): s is NonNullable<typeof s> => Boolean(s));
              const resolve = async () => {
                "use server";
                await actResolveNote(n.id, revalidate);
              };
              return (
                <li
                  key={n.id}
                  className={`rounded-md border px-3 py-2.5 ${
                    n.resolvedAt
                      ? "border-[var(--color-border)] bg-[var(--color-surface-2)] opacity-70"
                      : "border-[var(--color-border-strong)] bg-[var(--color-surface)]"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-[var(--color-muted)]">
                    <span>
                      <span className="font-medium text-[var(--color-ink-2)]">
                        {n.author.name}
                      </span>
                      <span className="mx-1.5">·</span>
                      <span className="font-mono">
                        {n.createdAt
                          .toISOString()
                          .slice(0, 16)
                          .replace("T", " ")}
                      </span>
                    </span>
                    {!n.resolvedAt && (
                      <form action={resolve}>
                        <button
                          type="submit"
                          className="text-[10.5px] uppercase tracking-wider text-[var(--color-primary)] hover:underline"
                        >
                          Resolve
                        </button>
                      </form>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] text-[var(--color-ink-2)] whitespace-pre-wrap">
                    {n.body}
                  </p>
                  {mentionedStaff.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1 text-[10.5px]">
                      {mentionedStaff.map((m) => (
                        <span
                          key={m.id}
                          className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 font-mono text-[var(--color-primary-ink)]"
                        >
                          @{m.name.split(" ")[0]}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
