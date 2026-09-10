import type { SVGProps } from "react";

const paths = {
  fish: "M6 12c3-7 10-8 15 0-5 8-12 7-15 0ZM6 12 2 8v8l4-4ZM16 10h.01M11 6l2-3M11 18l2 3",
  home: "m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM8 14h2M14 14h2M8 18h2",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  album: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM3 16l5-5 4 4 4-6 5 7M8 7h.01",
  chart: "M4 3v18h17M8 16v-5M13 16V7M18 16V4",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.9",
  settings: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z",
  "arrow-right": "M4 12h16m-6-6 6 6-6 6",
  "arrow-left": "M20 12H4m6-6-6 6 6 6",
  plus: "M12 5v14M5 12h14",
  camera: "M8 5 9 3h6l1 2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  trophy: "M8 3h8v7a4 4 0 0 1-8 0V3ZM8 5H3v2a4 4 0 0 0 5 4M16 5h5v2a4 4 0 0 1-5 4M12 14v6M7 21h10",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6v6l4 2",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  search: "M19 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-2 7 5 5",
  "chevron-down": "m6 9 6 6 6-6",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1",
  waves: "M2 6c4-4 6 4 10 0s6 4 10 0M2 12c4-4 6 4 10 0s6 4 10 0M2 18c4-4 6 4 10 0s6 4 10 0",
  leaf: "M20 3C8 2 1 8 5 16c8 4 14-3 15-13ZM3 21 15 9",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  menu: "M4 6h16M4 12h16M4 18h16",
  grid: "M3 3h7v7H3V3ZM14 3h7v7h-7V3ZM3 14h7v7H3v-7ZM14 14h7v7h-7v-7Z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  filter: "M4 7h16M7 12h10M10 17h4",
  scale: "M12 3v18M5 21h14M4 7h16M6 7l-4 8h8L6 7ZM18 7l-4 8h8l-4-8Z",
  ruler: "m3 17 14-14 4 4L7 21l-4-4ZM7 13l2 2M11 9l2 2M15 5l2 2",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 22, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
