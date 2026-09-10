"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo } from "react";
import { Avatar } from "@/components/profiles/Avatar";
import { useCurrentProfile } from "@/components/profiles/ProfileGate";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, EmptyState } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScreenLoading } from "@/components/ui/ScreenLoading";
import { speciesName } from "@/data/especies";
import { getDb } from "@/lib/db";
import type { Catch } from "@/lib/db/schema";
import { useObjectUrl } from "@/lib/hooks/useObjectUrl";
import { computeProfileStats, localCatchDate } from "@/lib/stats/profile";
import { formatLength, formatWeight } from "@/lib/utils/format";

function dayLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

const number = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function StatsScreen() {
  const profile = useCurrentProfile();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [trips, catches] = await Promise.all([
      db.trips.where("profileId").equals(profile.id).toArray(),
      db.catches.where("profileId").equals(profile.id).toArray(),
    ]);
    return { trips, catches };
  }, [profile.id]);
  const stats = useMemo(() => data ? computeProfileStats(profile.id, data.trips, data.catches) : null, [data, profile.id]);

  if (!stats) return <ScreenLoading />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Suas conquistas" subtitle="Cada pescaria faz parte da sua história." />

      <nav aria-label="Estatísticas e comparação" className="flex gap-2 rounded-2xl bg-surface-2 p-1.5">
        <Link href="/estatisticas" aria-current="page" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-surface px-3 text-sm font-bold text-brand shadow-sm"><Icon name="chart" size={18} /> Meus números</Link>
        <Link href="/comparar" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface"><Icon name="users" size={18} /> Comparar</Link>
      </nav>

      <section className="relative overflow-hidden rounded-[1.75rem] bg-brand p-6 text-white sm:p-8" aria-label="Resumo do pescador">
        <Icon name="waves" size={220} className="pointer-events-none absolute -bottom-16 -right-8 rotate-[-12deg] opacity-[0.07]" />
        <div className="relative flex items-center gap-4">
          <Avatar avatar={profile.avatar} name={profile.name} size={62} className="rounded-full border-2 border-white/30" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">Caderno do pescador</p>
            <h2 className="mt-1 break-words font-display text-3xl leading-tight">{profile.name}</h2>
          </div>
        </div>
        <p className="relative mt-5 max-w-lg text-sm leading-relaxed text-white/80">Dos primeiros arremessos aos peixes inesquecíveis. Aqui ficam os números de todos os seus dias de pesca.</p>
        <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-white/20 pt-5">
          <HeroNumber value={stats.totalCatches} label="peixes registrados" />
          <HeroNumber value={stats.completedTrips} label="pescarias concluídas" />
          <HeroNumber value={stats.speciesCount} label="espécies identificadas" />
        </div>
      </section>

      {stats.totalCatches === 0 && stats.completedTrips === 0 ? (
        <EmptyState icon={<Icon name="trophy" size={42} />} title="A primeira conquista vem aí" description="Registre seus peixes durante a pescaria. Seus recordes e melhores dias vão aparecer aqui, automaticamente." action={<Button href="/" icon={<Icon name="fish" />}>Vamos pescar</Button>} />
      ) : (
        <>
          <section aria-labelledby="records-title">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="records-title" className="font-display text-2xl">Peixes para lembrar</h2>
              <Button href="/album" variant="ghost" size="sm" icon={<Icon name="album" size={18} />}>Ver álbum</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <RecordCard title="Recorde de peso" icon="scale" item={stats.biggestCatch} value={formatWeight(stats.biggestCatch?.weightKg)} empty="Adicione o peso de uma captura para descobrir seu recorde." />
              <RecordCard title="Maior comprimento" icon="ruler" item={stats.longestCatch} value={formatLength(stats.longestCatch?.lengthCm)} empty="Adicione o comprimento de uma captura para guardar esse recorde." />
            </div>
          </section>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card className="border-accent/20 bg-accent/5">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-accent/15 text-accent-strong"><Icon name="sun" /></span>
                <CardTitle>Seu melhor dia</CardTitle>
              </div>
              {stats.bestDay ? (
                <>
                  <p className="font-display text-5xl text-brand">{number(stats.bestDay.count)} <span className="text-xl">{stats.bestDay.count === 1 ? "peixe" : "peixes"}</span></p>
                  <p className="mt-2 text-sm font-semibold">{dayLabel(stats.bestDay.date)}</p>
                  {stats.bestDay.tiedDates.length > 1 && (
                    <details className="mt-3 text-sm text-muted">
                      <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium">Empate em {stats.bestDay.tiedDates.length} dias <Icon name="chevron-down" size={16} /></summary>
                      <ul className="mt-1 space-y-2">{stats.bestDay.tiedDates.slice(1).map((date) => <li key={date}>{dayLabel(date)}</li>)}</ul>
                    </details>
                  )}
                  <p className="mt-3 text-xs leading-relaxed text-muted">Somamos as capturas de todas as pescarias no mesmo dia, no horário deste aparelho.</p>
                </>
              ) : <p className="text-sm text-muted">Seu melhor dia aparece quando você registra a primeira captura com data válida.</p>}
            </Card>

            <Card>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Icon name="clock" /></span>
                <CardTitle>Tempo bem vivido</CardTitle>
              </div>
              <dl className="space-y-4">
                <div className="flex items-center justify-between gap-4"><dt className="text-sm text-muted">Horas de pesca</dt><dd className="text-xl font-bold tabular-nums">{stats.timedTrips ? `${number(stats.totalHours)} h` : "—"}</dd></div>
                <div className="flex items-center justify-between gap-4"><dt className="text-sm text-muted">Média de peixes por pescaria</dt><dd className="text-xl font-bold tabular-nums">{stats.averageCatchesPerTrip === null ? "—" : number(stats.averageCatchesPerTrip)}</dd></div>
                <div className="flex items-center justify-between gap-4"><dt className="text-sm text-muted">Dias com capturas</dt><dd className="text-xl font-bold tabular-nums">{number(stats.byDay.length)}</dd></div>
              </dl>
              <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted">A média considera só pescarias concluídas, inclusive as sem peixe. O tempo soma {stats.timedTrips} {stats.timedTrips === 1 ? "pescaria com início e fim registrados" : "pescarias com início e fim registrados"}.</p>
            </Card>
          </div>

          {stats.species.length > 0 && (
            <Card>
              <div className="mb-5 flex items-center gap-3"><Icon name="fish" className="text-brand" /><CardTitle>Os peixes da sua história</CardTitle></div>
              <ul className="space-y-5">
                {stats.species.slice(0, 6).map((item) => (
                  <li key={item.key}>
                    <div className="mb-2 flex items-baseline justify-between gap-3 text-sm"><span className="font-semibold">{speciesName(item.speciesId, item.speciesCustom)}</span><span className="shrink-0 text-muted">{item.count} {item.count === 1 ? "peixe" : "peixes"}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true"><div className="h-full rounded-full bg-brand" style={{ width: `${item.count / stats.totalCatches * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
              {stats.species.length > 6 && <p className="mt-4 text-sm text-muted">As seis espécies mais registradas. Todas as capturas estão no álbum.</p>}
            </Card>
          )}

          {stats.tripStats.some(({ trip }) => trip.status === "concluida") && (
            <section aria-labelledby="recent-trips-title">
              <div className="mb-4 flex items-center justify-between gap-3"><h2 id="recent-trips-title" className="font-display text-2xl">Pescarias que contam</h2><Button href="/historico" variant="ghost" size="sm">Ver todas</Button></div>
              <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                {stats.tripStats.filter(({ trip }) => trip.status === "concluida").slice(0, 4).map(({ trip, count, hours }) => (
                  <Link key={trip.id} href={`/pescaria?id=${encodeURIComponent(trip.id)}`} className="flex min-h-20 items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 hover:bg-surface-2">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon name="calendar" size={19} /></span>
                    <div className="min-w-0 flex-1"><p className="truncate font-semibold">{trip.title || trip.locationName || "Dia de pescaria"}</p><p className="mt-1 text-xs text-muted">{localCatchDate(trip.startedAt || trip.plannedAt) ? dayLabel(localCatchDate(trip.startedAt || trip.plannedAt)!) : "Data não informada"}{hours !== null ? ` · ${number(hours)} h` : ""}</p></div>
                    <span className="shrink-0 text-sm font-bold text-brand">{count} {count === 1 ? "peixe" : "peixes"}</span><Icon name="arrow-right" size={17} className="hidden shrink-0 text-muted sm:block" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <Link href="/comparar" className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-brand/30">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Icon name="users" size={24} /></span>
        <div className="min-w-0 flex-1"><p className="font-semibold">Uma boa disputa entre pescadores</p><p className="mt-1 text-sm text-muted">Compare suas conquistas com os outros perfis.</p></div><Icon name="arrow-right" className="shrink-0 text-brand" />
      </Link>
      <p className="text-center text-xs leading-relaxed text-muted">Todo o histórico deste perfil, salvo neste aparelho. Cada captura vale um peixe.</p>
    </div>
  );
}

function HeroNumber({ value, label }: { value: number; label: string }) {
  return <div><p className="font-display text-4xl tabular-nums sm:text-5xl">{number(value)}</p><p className="mt-2 max-w-28 text-xs leading-relaxed text-white/75">{label}</p></div>;
}

function RecordCard({ title, icon, item, value, empty }: { title: string; icon: IconName; item: Catch | null; value: string; empty: string }) {
  const photo = useObjectUrl(item?.photo);
  const day = item ? localCatchDate(item.caughtAt) : null;
  return (
    <Card className="flex flex-col">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted"><Icon name={icon} size={18} />{title}</div>
      {item ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0"><p className="font-display text-4xl text-brand">{value}</p><p className="mt-2 font-semibold">{speciesName(item.speciesId, item.speciesCustom)}</p></div>
            {photo ? (
              // Local capture photos are Blob URLs and do not need an image server.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={speciesName(item.speciesId, item.speciesCustom)} className="size-20 rounded-2xl object-cover" />
            ) : <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Icon name="trophy" size={30} /></span>}
          </div>
          <p className="mt-4 text-xs text-muted">{day ? dayLabel(day) : "Data não informada"}</p>
          <Link href={`/album?captura=${encodeURIComponent(item.id)}`} className="mt-3 flex min-h-11 items-center gap-2 text-sm font-bold text-brand">Rever essa captura <Icon name="arrow-right" size={16} /></Link>
        </>
      ) : <><p className="font-display text-4xl text-muted">—</p><p className="mt-3 text-sm leading-relaxed text-muted">{empty}</p></>}
    </Card>
  );
}
