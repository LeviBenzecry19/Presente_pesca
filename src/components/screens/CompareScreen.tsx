"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/profiles/Avatar";
import { useCurrentProfile } from "@/components/profiles/ProfileGate";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, EmptyState } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScreenLoading } from "@/components/ui/ScreenLoading";
import { speciesName } from "@/data/especies";
import { getDb } from "@/lib/db";
import type { Profile } from "@/lib/db/schema";
import { computeProfileStats, rankProfiles, type ProfileStats, type RankingMetric } from "@/lib/stats/profile";
import { formatWeight } from "@/lib/utils/format";

const number = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

interface MetricInfo {
  value: RankingMetric;
  label: string;
  short: string;
  /** Texto do valor de cada pescador nesta disputa. */
  format: (stats: ProfileStats) => string;
  /** Explica o que fica de fora — ninguém deve achar que perdeu por bug. */
  note: string;
}

const METRICS: MetricInfo[] = [
  {
    value: "catches",
    label: "Quem pescou mais peixes",
    short: "Peixes",
    format: (s) => `${number(s.totalCatches)} ${s.totalCatches === 1 ? "peixe" : "peixes"}`,
    note: "Conta todas as capturas registradas, de todas as pescarias.",
  },
  {
    value: "weight",
    label: "Quem fisgou o maior peixe",
    short: "Maior peso",
    format: (s) => (s.biggestCatch ? formatWeight(s.biggestCatch.weightKg) : "sem peso registrado"),
    note: "Só entra na disputa quem anotou o peso de pelo menos uma captura.",
  },
  {
    value: "bestDay",
    label: "Quem teve o melhor dia",
    short: "Melhor dia",
    format: (s) => (s.bestDay ? `${number(s.bestDay.count)} ${s.bestDay.count === 1 ? "peixe" : "peixes"} num dia` : "nenhum dia registrado"),
    note: "Somamos as capturas de cada dia do calendário, juntando pescarias diferentes.",
  },
];

const MEDAL = ["🥇", "🥈", "🥉"];

/**
 * A disputa entre os perfis do aparelho. É um app de família: comparar é
 * brincadeira, então cada número vem com a regra do que entra na conta.
 */
export function CompareScreen() {
  const current = useCurrentProfile();
  const [metric, setMetric] = useState<RankingMetric>("catches");

  const data = useLiveQuery(async () => {
    const db = getDb();
    const [profiles, trips, catches] = await Promise.all([
      db.profiles.orderBy("createdAt").toArray(),
      db.trips.toArray(),
      db.catches.toArray(),
    ]);
    return { profiles, trips, catches };
  }, []);

  const entries = useMemo(() => {
    if (!data) return [];
    return data.profiles.map((profile) => ({
      profileId: profile.id,
      name: profile.name,
      profile,
      stats: computeProfileStats(profile.id, data.trips, data.catches),
    }));
  }, [data]);

  const info = METRICS.find((m) => m.value === metric)!;
  const rows = useMemo(() => rankProfiles(entries, metric), [entries, metric]);

  if (!data) return <ScreenLoading />;

  if (data.profiles.length < 2) {
    return (
      <div className="flex flex-col gap-6">
        <CompareHeader />
        <EmptyState
          icon={<Icon name="users" size={42} />}
          title="A disputa precisa de companhia"
          description="Crie um perfil para cada pescador da casa e os números de todo mundo aparecem lado a lado aqui."
          action={<Button href="/perfis" icon={<Icon name="plus" size={18} />}>Gerenciar perfis</Button>}
        />
      </div>
    );
  }

  const nobodyFished = entries.every((e) => e.stats.totalCatches === 0);

  return (
    <div className="flex flex-col gap-6">
      <CompareHeader />

      <div role="radiogroup" aria-label="O que comparar" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {METRICS.map((m) => {
          const active = m.value === metric;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMetric(m.value)}
              className={`min-h-11 shrink-0 rounded-full border-2 px-4 text-sm font-semibold ${
                active ? "border-brand bg-brand-soft text-brand-strong" : "border-border bg-surface text-muted"
              }`}
            >
              {m.short}
            </button>
          );
        })}
      </div>

      <section aria-labelledby="ranking-title" className="flex flex-col gap-3">
        <h2 id="ranking-title" className="font-display text-2xl">{info.label}</h2>

        {nobodyFished ? (
          <EmptyState
            icon={<Icon name="fish" size={42} />}
            title="Ninguém marcou pontos ainda"
            description="Assim que as primeiras capturas forem registradas, o pódio aparece sozinho."
            action={<Button href="/" icon={<Icon name="fish" />}>Vamos pescar</Button>}
          />
        ) : (
          <ol className="flex flex-col gap-2">
            {rows.map((row) => {
              const you = row.profileId === current.id;
              return (
                <li key={row.profileId}>
                  <div
                    className={`flex items-center gap-4 rounded-2xl border p-4 ${
                      you ? "border-brand/40 bg-brand-soft/40" : "border-border bg-surface"
                    }`}
                  >
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-lg font-bold tabular-nums text-muted"
                      aria-hidden
                    >
                      {row.rank === null ? "—" : (MEDAL[row.rank - 1] ?? row.rank)}
                    </span>
                    <Avatar avatar={row.profile.avatar} name={row.profile.name} size={44} className="rounded-full" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {row.profile.name}
                        {you && <span className="ml-2 text-xs font-bold text-brand">você</span>}
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        <span className="sr-only">
                          {row.rank === null ? "Sem classificação. " : `${row.rank}º lugar${row.tied ? ", empatado" : ""}. `}
                        </span>
                        {info.format(row.stats)}
                        {row.tied && <span className="ml-2 text-xs font-bold text-accent-strong">empate</span>}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <p className="text-xs leading-relaxed text-muted">{info.note}</p>
      </section>

      <Card>
        <CardTitle>Lado a lado</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-100 border-collapse text-sm">
            <caption className="sr-only">Números de cada pescador deste aparelho</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="py-2 pr-3 font-bold">Pescador</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Peixes</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Pescarias</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Espécies</th>
                <th scope="col" className="py-2 text-right font-bold">Maior peso</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(({ profile, stats }) => (
                <tr key={profile.id} className="border-b border-border last:border-0">
                  <th scope="row" className="max-w-40 truncate py-3 pr-3 text-left font-semibold">
                    {profile.name}
                  </th>
                  <td className="py-3 pr-3 text-right tabular-nums">{number(stats.totalCatches)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{number(stats.completedTrips)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{number(stats.speciesCount)}</td>
                  <td className="py-3 text-right tabular-nums">
                    {stats.biggestCatch ? formatWeight(stats.biggestCatch.weightKg) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted">
          Pescarias contam as concluídas. Espécies não contam os peixes salvos como “outra” sem nome.
        </p>
      </Card>

      <SpeciesDuel entries={entries} />

      <p className="text-center text-xs leading-relaxed text-muted">
        Só os perfis deste aparelho entram na disputa. Nada disso é publicado para outras pessoas.
      </p>
    </div>
  );
}

function CompareHeader() {
  return (
    <>
      <PageHeader title="Uma boa disputa" subtitle="Como andam os pescadores da casa." back="/estatisticas" />
      <nav aria-label="Estatísticas e comparação" className="-mt-1 flex gap-2 rounded-2xl bg-surface-2 p-1.5">
        <Link
          href="/estatisticas"
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface"
        >
          <Icon name="chart" size={18} /> Meus números
        </Link>
        <Link
          href="/comparar"
          aria-current="page"
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-surface px-3 text-sm font-bold text-brand shadow-sm"
        >
          <Icon name="users" size={18} /> Comparar
        </Link>
      </nav>
    </>
  );
}

/** Quem pegou mais de cada espécie — a discussão que rende no grupo da família. */
function SpeciesDuel({
  entries,
}: {
  entries: { profile: Profile; stats: ProfileStats }[];
}) {
  const duels = useMemo(() => {
    const byKey = new Map<string, { label: string; leaders: string[]; count: number; total: number }>();
    for (const { profile, stats } of entries) {
      for (const species of stats.species) {
        if (species.key === "outra:") continue;
        const label = speciesName(species.speciesId, species.speciesCustom);
        const row = byKey.get(species.key) ?? { label, leaders: [], count: 0, total: 0 };
        row.total += species.count;
        if (species.count > row.count) {
          row.count = species.count;
          row.leaders = [profile.name];
        } else if (species.count === row.count) {
          row.leaders.push(profile.name);
        }
        byKey.set(species.key, row);
      }
    }
    return [...byKey.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "pt-BR")).slice(0, 6);
  }, [entries]);

  if (duels.length === 0) return null;

  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <Icon name="fish" className="text-brand" />
        <CardTitle>Dono de cada peixe</CardTitle>
      </div>
      <ul className="space-y-4">
        {duels.map((duel) => (
          <li key={duel.label} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold">{duel.label}</span>
            <span className="shrink-0 text-right text-muted">
              {duel.leaders.join(" e ")} · {duel.count} {duel.count === 1 ? "peixe" : "peixes"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted">
        As seis espécies mais registradas no aparelho, com quem pegou mais de cada uma.
      </p>
    </Card>
  );
}
