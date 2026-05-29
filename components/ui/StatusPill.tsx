import { cn } from "@/lib/util/cn";

type Status = "PENDING" | "DUE" | "COMPLETED" | "OVERDUE" | "SKIPPED";

const STYLES: Record<Status, string> = {
  PENDING: "bg-[var(--color-status-pending-soft)] text-[var(--color-status-pending)]",
  DUE: "bg-[var(--color-status-due-soft)] text-[var(--color-status-due)]",
  COMPLETED: "bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]",
  OVERDUE: "bg-[var(--color-status-overdue-soft)] text-[var(--color-status-overdue)]",
  SKIPPED: "bg-[var(--color-status-skipped-soft)] text-[var(--color-status-skipped)]",
};

export function StatusPill({
  status,
  className,
  size = "sm",
}: {
  status: Status | string;
  className?: string;
  size?: "sm" | "md";
}) {
  const safe = (STYLES[status as Status] ?? STYLES.PENDING) as string;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium uppercase tracking-wider",
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        safe,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
