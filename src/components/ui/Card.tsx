import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...rest} className={`rounded-2xl border border-border bg-surface p-5 shadow-[0_2px_10px_#183d2503] ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-display text-xl font-medium text-foreground ${className}`}>{children}</h2>;
}

type Tone = "brand" | "accent" | "success" | "warning" | "danger" | "muted";

const TONE: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-strong",
  accent: "bg-accent/20 text-accent-strong",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning",
  danger: "bg-danger/15 text-danger",
  muted: "bg-surface-2 text-muted",
};

export function Badge({ tone = "muted", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Notice({ tone = "muted", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm font-medium ${TONE[tone]} ${className}`}>
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-brand-soft text-3xl text-brand" aria-hidden>{icon}</div>
      <p className="font-display text-2xl">{title}</p>
      {description && <p className="max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold leading-tight tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
