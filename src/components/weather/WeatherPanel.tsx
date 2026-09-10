"use client";

import { useMemo } from "react";
import { Badge, Card, CardTitle, Stat } from "@/components/ui/Card";
import type { WeatherSnapshot } from "@/lib/db/schema";
import { computeFishingForecast, scoreLabel, type ScoreTone } from "@/lib/forecast/heuristics";
import { weatherCodeInfo } from "@/lib/weather/codes";
import { moonEmoji } from "@/lib/weather/moon";
import { hourOf, pickHour } from "@/lib/weather/openMeteo";
import { formatPressure, formatTemp, formatWind, windDirectionLabel } from "@/lib/utils/format";

const TONE_BG: Record<ScoreTone, string> = {
  success: "bg-success",
  brand: "bg-brand",
  warning: "bg-warning",
  danger: "bg-danger",
};

function timeOnly(local: string | null): string {
  if (!local) return "—";
  const m = /T(\d{2}:\d{2})/.exec(local);
  return m ? m[1] : local;
}

export function WeatherPanel({ snapshot, plannedAt }: { snapshot: WeatherSnapshot; plannedAt: string }) {
  const forecast = useMemo(() => computeFishingForecast(snapshot), [snapshot]);
  const at = pickHour(snapshot, plannedAt);
  const code = weatherCodeInfo(at?.weatherCode);
  const day = scoreLabel(forecast.dayScore);
  const fetched = new Date(snapshot.fetchedAt);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Clima previsto</CardTitle>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-5xl leading-none" aria-hidden>{code.emoji}</span>
              <div>
                <div className="text-4xl font-extrabold leading-none">{formatTemp(at?.temperatureC)}</div>
                <div className="text-sm text-muted">{code.label}</div>
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-muted">
            <div>🌅 {timeOnly(snapshot.sunrise)}</div>
            <div>🌇 {timeOnly(snapshot.sunset)}</div>
            <div className="mt-1">{moonEmoji(snapshot.moon.phase)} {snapshot.moon.label}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Vento" value={formatWind(at?.windKmh)} sub={windDirectionLabel(at?.windDirDeg)} />
          <Stat label="Pressão" value={formatPressure(at?.pressureHpa)} />
          <Stat label="Chuva" value={at?.precipitationProbPct != null ? `${Math.round(at.precipitationProbPct)}%` : `${at?.precipitationMm ?? 0} mm`} sub={at?.precipitationProbPct != null ? `${at?.precipitationMm ?? 0} mm` : undefined} />
          <Stat label="Umidade" value={at?.humidityPct != null ? `${Math.round(at.humidityPct)}%` : "—"} sub={at?.cloudCoverPct != null ? `${Math.round(at.cloudCoverPct)}% nuvens` : undefined} />
        </div>

        <div className="mt-4 -mx-4 overflow-x-auto px-4 pb-1">
          <ol className="flex gap-1.5" aria-label="Previsão por hora">
            {snapshot.hours.map((h, i) => {
              const hs = forecast.hours[i];
              const tone = scoreLabel(hs.score).tone;
              const isPlanned = at && h.time === at.time;
              return (
                <li
                  key={h.time}
                  className={`flex w-14 shrink-0 flex-col items-center gap-1 rounded-xl py-2 text-center ${isPlanned ? "bg-brand-soft ring-2 ring-brand" : "bg-surface-2"}`}
                  title={`${hs.score}/100 · ${hs.reasons.join(", ") || "sem destaques"}`}
                >
                  <span className="text-[11px] font-bold text-muted">{String(hourOf(h.time)).padStart(2, "0")}h</span>
                  <span className="text-lg leading-none" aria-hidden>{weatherCodeInfo(h.weatherCode).emoji}</span>
                  <span className="text-sm font-bold">{formatTemp(h.temperatureC)}</span>
                  <span className={`h-1.5 w-8 rounded-full ${TONE_BG[tone]}`} aria-label={`Pesca: ${hs.score}`} />
                </li>
              );
            })}
          </ol>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Fonte: Open-Meteo · atualizado {fetched.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Previsão de pesca</CardTitle>
          <Badge tone={day.tone}>{day.label} · {forecast.dayScore}/100</Badge>
        </div>

        {forecast.bestWindows.length > 0 ? (
          <div className="mt-3">
            <p className="text-sm font-semibold">Melhores janelas</p>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {forecast.bestWindows.map((w) => (
                <li key={w.start} className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-bold text-brand-strong">
                  {String(hourOf(w.start)).padStart(2, "0")}h–{String(hourOf(w.end) + 1).padStart(2, "0")}h
                  <span className="ml-1 font-medium opacity-80">({w.score})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Nenhuma janela claramente favorável neste dia. Prefira amanhecer e entardecer.</p>
        )}

        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {forecast.highlights.map((h) => (
            <li key={h} className="flex gap-2">
              <span aria-hidden>•</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted">
          Estimativa por regras (crepúsculo, lua, pressão, vento, chuva, temperatura). Vai melhorar com o histórico de capturas.
        </p>
      </Card>
    </div>
  );
}

/** Resumo compacto para cards de lista. */
export function WeatherMini({ snapshot, plannedAt }: { snapshot: WeatherSnapshot; plannedAt: string }) {
  const at = pickHour(snapshot, plannedAt);
  const code = weatherCodeInfo(at?.weatherCode);
  const forecast = computeFishingForecast(snapshot);
  const day = scoreLabel(forecast.dayScore);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span aria-hidden>{code.emoji}</span>
      <span className="font-semibold">{formatTemp(at?.temperatureC)}</span>
      <span className="text-muted">· {formatWind(at?.windKmh)}</span>
      <Badge tone={day.tone} className="ml-auto">Pesca: {day.label}</Badge>
    </div>
  );
}
