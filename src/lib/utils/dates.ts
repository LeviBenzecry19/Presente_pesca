import {
  format,
  formatDistanceStrict,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export function nowIso(): string {
  return new Date().toISOString();
}

function asDate(d: Date | string): Date {
  return typeof d === "string" ? parseISO(d) : d;
}

/** "2026-09-08" no fuso local. */
export function toLocalDateKey(d: Date | string): string {
  return format(asDate(d), "yyyy-MM-dd");
}

/** Valor para <input type="datetime-local"> no fuso local. */
export function toDateTimeLocalValue(d: Date | string): string {
  return format(asDate(d), "yyyy-MM-dd'T'HH:mm");
}

export function fromDateTimeLocalValue(value: string): Date {
  // `new Date("yyyy-MM-ddTHH:mm")` é interpretado como horário local.
  return new Date(value);
}

export function formatDateTime(d: Date | string): string {
  return format(asDate(d), "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR });
}

export function formatDateLong(d: Date | string): string {
  return format(asDate(d), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function formatDateShort(d: Date | string): string {
  return format(asDate(d), "dd/MM/yyyy", { locale: ptBR });
}

export function formatTime(d: Date | string): string {
  return format(asDate(d), "HH:mm");
}

export function formatRelativeDay(d: Date | string): string {
  const date = asDate(d);
  if (isToday(date)) return "Hoje";
  if (isTomorrow(date)) return "Amanhã";
  if (isYesterday(date)) return "Ontem";
  return format(date, "d 'de' MMM", { locale: ptBR });
}

export function formatDuration(startIso: string, endIso?: string | null): string {
  const start = parseISO(startIso);
  const end = endIso ? parseISO(endIso) : new Date();
  return formatDistanceStrict(start, end, { locale: ptBR });
}

export function hoursBetween(startIso: string, endIso: string): number {
  return (parseISO(endIso).getTime() - parseISO(startIso).getTime()) / 36e5;
}

/** "Março de 2026" — cabeçalho de agrupamento por mês. */
export function formatMonthLong(d: Date | string): string {
  const label = format(asDate(d), "MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}
