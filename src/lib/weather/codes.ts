/** Códigos WMO usados pelo Open-Meteo → descrição em pt-BR. */
export interface WeatherCodeInfo {
  label: string;
  emoji: string;
  /** Intensidade de precipitação implícita (0 nenhuma, 1 fraca, 2 moderada, 3 forte). */
  rainLevel: 0 | 1 | 2 | 3;
  storm: boolean;
}

const TABLE: Record<number, WeatherCodeInfo> = {
  0: { label: "Céu limpo", emoji: "☀️", rainLevel: 0, storm: false },
  1: { label: "Predominantemente limpo", emoji: "🌤️", rainLevel: 0, storm: false },
  2: { label: "Parcialmente nublado", emoji: "⛅", rainLevel: 0, storm: false },
  3: { label: "Nublado", emoji: "☁️", rainLevel: 0, storm: false },
  45: { label: "Nevoeiro", emoji: "🌫️", rainLevel: 0, storm: false },
  48: { label: "Nevoeiro com geada", emoji: "🌫️", rainLevel: 0, storm: false },
  51: { label: "Chuvisco fraco", emoji: "🌦️", rainLevel: 1, storm: false },
  53: { label: "Chuvisco moderado", emoji: "🌦️", rainLevel: 1, storm: false },
  55: { label: "Chuvisco intenso", emoji: "🌧️", rainLevel: 2, storm: false },
  56: { label: "Chuvisco congelante", emoji: "🌧️", rainLevel: 1, storm: false },
  57: { label: "Chuvisco congelante forte", emoji: "🌧️", rainLevel: 2, storm: false },
  61: { label: "Chuva fraca", emoji: "🌧️", rainLevel: 1, storm: false },
  63: { label: "Chuva moderada", emoji: "🌧️", rainLevel: 2, storm: false },
  65: { label: "Chuva forte", emoji: "🌧️", rainLevel: 3, storm: false },
  66: { label: "Chuva congelante", emoji: "🌧️", rainLevel: 2, storm: false },
  67: { label: "Chuva congelante forte", emoji: "🌧️", rainLevel: 3, storm: false },
  71: { label: "Neve fraca", emoji: "🌨️", rainLevel: 1, storm: false },
  73: { label: "Neve moderada", emoji: "🌨️", rainLevel: 2, storm: false },
  75: { label: "Neve forte", emoji: "🌨️", rainLevel: 3, storm: false },
  77: { label: "Grãos de neve", emoji: "🌨️", rainLevel: 1, storm: false },
  80: { label: "Pancadas fracas", emoji: "🌦️", rainLevel: 1, storm: false },
  81: { label: "Pancadas moderadas", emoji: "🌧️", rainLevel: 2, storm: false },
  82: { label: "Pancadas fortes", emoji: "🌧️", rainLevel: 3, storm: false },
  85: { label: "Pancadas de neve", emoji: "🌨️", rainLevel: 1, storm: false },
  86: { label: "Pancadas de neve fortes", emoji: "🌨️", rainLevel: 3, storm: false },
  95: { label: "Tempestade", emoji: "⛈️", rainLevel: 3, storm: true },
  96: { label: "Tempestade com granizo", emoji: "⛈️", rainLevel: 3, storm: true },
  99: { label: "Tempestade com granizo forte", emoji: "⛈️", rainLevel: 3, storm: true },
};

const UNKNOWN: WeatherCodeInfo = { label: "Sem dados", emoji: "❔", rainLevel: 0, storm: false };

export function weatherCodeInfo(code: number | null | undefined): WeatherCodeInfo {
  if (code == null) return UNKNOWN;
  return TABLE[code] ?? UNKNOWN;
}
