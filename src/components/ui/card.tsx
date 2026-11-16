import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-stone-200/80 bg-white p-5 shadow-soft", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm text-stone-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  danger: "bg-red-50 text-red-700 border-red-100",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  info: "bg-sage-100 text-sage-800 border-sage-200",
  neutral: "bg-stone-100 text-stone-600 border-stone-200",
  success: "bg-forest-50 text-forest-700 border-forest-100",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof badgeStyles;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        badgeStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
