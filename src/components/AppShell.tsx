"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/profiles/Avatar";
import type { Profile } from "@/lib/db/schema";
import { useOnline } from "@/lib/hooks/useOnline";

const NAV = [
  { href: "/", label: "Início", icon: HomeIcon },
  { href: "/planejar", label: "Planejar", icon: CalendarIcon },
  { href: "/spots", label: "Spots", icon: PinIcon },
  { href: "/historico", label: "Histórico", icon: HistoryIcon },
  { href: "/configuracoes", label: "Ajustes", icon: GearIcon },
] as const;

export function AppShell({ children, profile }: { children: ReactNode; profile: Profile }) {
  const pathname = usePathname();
  const online = useOnline();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-surface/95 px-4 py-2 backdrop-blur">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold text-brand">
          <span aria-hidden>🎣</span> Pesca
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
              online ? "bg-success/15 text-success" : "bg-warning/20 text-warning"
            }`}
            title={online ? "Conectado" : "Sem conexão — dados salvos no aparelho"}
          >
            <span className={`size-2 rounded-full ${online ? "bg-success" : "bg-warning"}`} aria-hidden />
            {online ? "Online" : "Offline"}
          </span>
          <Link
            href="/perfis"
            className="flex items-center gap-2 rounded-full py-0.5 pl-2 pr-0.5 hover:bg-surface-2"
            title={`Perfil de ${profile.name} — tocar para trocar`}
          >
            <span className="hidden max-w-24 truncate text-sm font-bold sm:inline">{profile.name}</span>
            <Avatar avatar={profile.avatar} name={profile.name} size={34} className="rounded-full" />
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      <nav
        aria-label="Navegação principal"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${
                    active ? "text-brand" : "text-muted"
                  }`}
                >
                  <Icon active={active} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

type IconProps = { active?: boolean };
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function HomeIcon({ active }: IconProps) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.2 : 0} />
    </svg>
  );
}
function CalendarIcon({ active }: IconProps) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.2 : 0} />
      <path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
    </svg>
  );
}
function PinIcon({ active }: IconProps) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.2 : 0} />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
function HistoryIcon({ active }: IconProps) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <circle cx="12" cy="12" r="9" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.2 : 0} />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function GearIcon({ active }: IconProps) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <circle cx="12" cy="12" r="3" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.3 : 0} />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
