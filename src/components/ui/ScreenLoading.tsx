export function ScreenLoading({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-surface-2" />
      <div className="h-28 animate-pulse rounded-2xl bg-surface-2" />
      <div className="h-28 animate-pulse rounded-2xl bg-surface-2" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
