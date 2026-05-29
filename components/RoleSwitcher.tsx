import Link from "next/link";
import { getRole, roleLabel } from "@/lib/auth/role";
import { actClearRole } from "@/app/actions/role";

export async function RoleSwitcher({
  redirectAfterSignOut = "/",
}: {
  redirectAfterSignOut?: string;
}) {
  const role = await getRole();

  const signOut = async () => {
    "use server";
    await actClearRole(redirectAfterSignOut);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="hidden sm:inline text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
        Signed in as
      </span>
      <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[12px]">
        {roleLabel(role)}
      </span>
      <form action={signOut}>
        <button
          type="submit"
          className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          Switch role
        </button>
      </form>
    </div>
  );
}

export async function MaybeLandingLink() {
  return (
    <Link
      href="/"
      className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
    >
      ← Landing
    </Link>
  );
}
