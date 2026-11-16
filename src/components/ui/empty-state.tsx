import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white/60 px-6 py-12 text-center", className)}>
      {icon ? <div className="mb-3 text-sage-500">{icon}</div> : null}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {body ? <p className="mt-1.5 max-w-sm text-sm text-stone-500">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
