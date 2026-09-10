import type { WeatherHour, WeatherSnapshot } from "@/lib/db/schema";
import { weatherCodeInfo } from "@/lib/weather/codes";
import { distanceToNewOrFull, moonEmoji } from "@/lib/weather/moon";
import { hourOf, minutesOf } from "@/lib/weather/openMeteo";

/**
 * Previsão de pesca por regras heurísticas (MVP — seção 4.3 da especificação).
 *
 * Cada hora recebe uma nota 0–100 a partir de fatores conhecidos da pesca
 * amadora: crepúsculos, fase da lua, tendência de pressão, vento, chuva,
 * temperatura e nebulosidade. Quando houver base própria de capturas
 * (seção 5.1), estas regras serão substituídas/calibradas por um modelo.
 */

export type ScoreTone = "success" | "brand" | "warning" | "danger";

export interface HourScore {
  time: string;
  hour: number;
  score: number;
  reasons: string[];
}

export interface BestWindow {
  start: string;
  end: string;
  score: number;
}

export interface FishingForecast {
  dayScore: number;
  hours: HourScore[];
  bestWindows: BestWindow[];
  highlights: string[];
}

export function scoreLabel(score: number): { label: string; tone: ScoreTone } {
  if (score >= 75) return { label: "Excelente", tone: "success" };
  if (score >= 60) return { label: "Bom", tone: "brand" };
  if (score >= 45) return { label: "Regular", tone: "warning" };
  return { label: "Fraco", tone: "danger" };
}

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

function scoreHour(
  h: WeatherHour,
  prev3: WeatherHour | undefined,
  sunriseMin: number | null,
  sunsetMin: number | null,
  moonDist: number,
): HourScore {
  let score = 50;
  const reasons: string[] = [];
  const hour = hourOf(h.time);
  const minute = hour * 60;

  // Crepúsculos: janelas clássicas de atividade.
  const nearDawn = sunriseMin != null && Math.abs(minute - sunriseMin) <= 90;
  const nearDusk = sunsetMin != null && Math.abs(minute - sunsetMin) <= 90;
  if (nearDawn || nearDusk) {
    score += 20;
    reasons.push(nearDawn ? "Amanhecer" : "Entardecer");
  } else if (hour >= 11 && hour <= 15) {
    score -= 10;
  }

  // Lua: nova e cheia costumam intensificar a alimentação.
  if (moonDist <= 0.06) score += 10;
  else if (moonDist <= 0.12) score += 5;

  // Pressão: queda lenta antes de frente fria é o cenário favorito; subida rápida, ruim.
  if (h.pressureHpa != null && prev3?.pressureHpa != null) {
    const delta = h.pressureHpa - prev3.pressureHpa;
    if (delta <= -1 && delta >= -3) {
      score += 10;
      reasons.push("Pressão caindo devagar");
    } else if (Math.abs(delta) < 1) {
      score += 5;
    } else if (delta > 3) {
      score -= 10;
      reasons.push("Pressão subindo rápido");
    } else if (delta < -4) {
      score -= 5;
      reasons.push("Queda brusca de pressão");
    }
  }
  if (h.pressureHpa != null && h.pressureHpa < 1000) score -= 5;

  // Vento: brisa ajuda (oxigena e disfarça a linha); ventania atrapalha.
  if (h.windKmh != null) {
    if (h.windKmh >= 5 && h.windKmh <= 20) {
      score += 5;
    } else if (h.windKmh > 30) {
      score -= 15;
      reasons.push("Vento forte");
    } else if (h.windKmh > 20) {
      score -= 5;
      reasons.push("Vento moderado");
    }
  }

  // Chuva: fina costuma ser boa; forte ou tempestade, não.
  const code = weatherCodeInfo(h.weatherCode);
  const mm = h.precipitationMm ?? 0;
  if (code.storm) {
    score -= 25;
    reasons.push("Tempestade");
  } else if (mm > 6 || code.rainLevel === 3) {
    score -= 15;
    reasons.push("Chuva forte");
  } else if (mm > 2 || code.rainLevel === 2) {
    score -= 5;
  } else if (mm > 0.1 || code.rainLevel === 1) {
    score += 5;
    reasons.push("Chuva fina");
  }

  // Temperatura do ar (proxy grosseiro da água).
  if (h.temperatureC != null) {
    if (h.temperatureC >= 18 && h.temperatureC <= 30) score += 5;
    else if (h.temperatureC < 10 || h.temperatureC > 36) {
      score -= 10;
      reasons.push(h.temperatureC < 10 ? "Frio intenso" : "Calor extremo");
    }
  }

  // Céu encoberto reduz luz e estende a atividade.
  if (h.cloudCoverPct != null && h.cloudCoverPct >= 40 && h.cloudCoverPct <= 90) score += 5;

  return { time: h.time, hour, score: clamp(Math.round(score)), reasons };
}

export function computeFishingForecast(snapshot: WeatherSnapshot): FishingForecast {
  const sunriseMin = minutesOf(snapshot.sunrise);
  const sunsetMin = minutesOf(snapshot.sunset);
  const moonDist = distanceToNewOrFull(snapshot.moon.phase);

  // Tendência de pressão: compara com 3 h antes (ou com a primeira hora do dia).
  const hours = snapshot.hours.map((h, i) => {
    const prev = i >= 3 ? snapshot.hours[i - 3] : i > 0 ? snapshot.hours[0] : undefined;
    return scoreHour(h, prev, sunriseMin, sunsetMin, moonDist);
  });

  const top = [...hours].sort((a, b) => b.score - a.score).slice(0, 6);
  const dayScore = top.length ? Math.round(top.reduce((s, h) => s + h.score, 0) / top.length) : 0;

  // Janelas: sequências contíguas de horas perto do melhor do dia. O corte é
  // relativo ao dayScore para destacar os picos (amanhecer/entardecer) em vez
  // de engolir a noite inteira quando o dia todo é razoável.
  const threshold = Math.max(50, dayScore - 10);
  const windows: BestWindow[] = [];
  let run: HourScore[] = [];
  const flush = () => {
    if (run.length) {
      const avg = run.reduce((s, r) => s + r.score, 0) / run.length;
      windows.push({ start: run[0].time, end: run[run.length - 1].time, score: Math.round(avg) });
    }
    run = [];
  };
  for (const hs of hours) {
    if (hs.score >= threshold) run.push(hs);
    else flush();
  }
  flush();
  windows.sort((a, b) => b.score - a.score);

  const highlights: string[] = [];
  highlights.push(`${moonEmoji(snapshot.moon.phase)} ${snapshot.moon.label} (${snapshot.moon.illuminationPct}% iluminada)`);
  if (moonDist <= 0.06) highlights.push("Fase lunar forte para pesca");

  const pressures = snapshot.hours.map((h) => h.pressureHpa).filter((p): p is number => p != null);
  if (pressures.length >= 2) {
    const delta = pressures[pressures.length - 1] - pressures[0];
    if (delta <= -3) highlights.push("Pressão em queda ao longo do dia (frente se aproximando)");
    else if (delta >= 3) highlights.push("Pressão subindo ao longo do dia (pós-frente, peixe mais parado)");
    else highlights.push("Pressão estável");
  }

  const maxWind = Math.max(0, ...snapshot.hours.map((h) => h.windKmh ?? 0));
  if (maxWind > 30) highlights.push(`Rajadas de até ${Math.round(maxWind)} km/h — atenção à segurança`);

  const totalRain = snapshot.hours.reduce((s, h) => s + (h.precipitationMm ?? 0), 0);
  if (snapshot.hours.some((h) => weatherCodeInfo(h.weatherCode).storm)) highlights.push("Risco de tempestade");
  else if (totalRain > 10) highlights.push(`Chuva acumulada prevista: ${Math.round(totalRain)} mm`);

  return { dayScore, hours, bestWindows: windows.slice(0, 3), highlights };
}
