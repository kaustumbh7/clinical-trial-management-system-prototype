import * as React from "react";
import { cn } from "@/lib/util/cn";

export function Card({
  className,
  children,
  variant = "default",
}: {
  className?: string;
  children: React.ReactNode;
  variant?: "default" | "warm" | "primary";
}) {
  const bg =
    variant === "warm"
      ? "bg-[var(--color-surface-2)]"
      : variant === "primary"
      ? "bg-[var(--color-primary-soft)]"
      : "bg-[var(--color-surface)]";
  return (
    <div className={cn("ring-subtle rounded-lg", bg, className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  hint,
  trailing,
  className,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-5 pt-5 pb-3",
        className,
      )}
    >
      <div>
        <h3 className="text-[15px] font-medium tracking-tight">{title}</h3>
        {hint && (
          <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">{hint}</p>
        )}
      </div>
      {trailing}
    </div>
  );
}
