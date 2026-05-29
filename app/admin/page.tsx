import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function AdminIndex() {
  const study = await prisma.study.findFirst({ orderBy: { createdAt: "asc" } });
  if (study) {
    redirect(`/admin/studies/${study.id}`);
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="font-display text-3xl tracking-tight">No studies yet</h1>
      <p className="mt-2 text-[14px] text-[var(--color-muted)]">
        Run <code className="font-mono text-[12px]">npx tsx prisma/seed.ts</code> to load
        the demo study.
      </p>
      <Link href="/" className="mt-6 inline-block text-[12px] text-[var(--color-primary)]">
        ← Back to landing
      </Link>
    </div>
  );
}
