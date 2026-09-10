"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  /** true = voltar no histórico; string = rota fixa. */
  back?: boolean | string;
  actions?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="mb-5 flex flex-wrap items-start gap-3">
      {back && (
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => (typeof back === "string" ? router.push(back) : router.back())}
          className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-brand hover:bg-brand-soft"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <div className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}
