/**
 * Busca de lugares via Nominatim (OpenStreetMap).
 * Política de uso: máx. 1 req/s e identificação do app. O Referer do site já
 * identifica a origem; o parâmetro `email` complementa quando configurado.
 */
const BASE = "https://nominatim.openstreetmap.org";

export interface PlaceResult {
  displayName: string;
  lat: number;
  lng: number;
  type?: string;
}

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  address?: Record<string, string>;
}

function contactParam(): string {
  const email = process.env.NEXT_PUBLIC_APP_CONTACT;
  return email ? `&email=${encodeURIComponent(email)}` : "";
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${BASE}/search?format=jsonv2&limit=6&accept-language=pt-BR&q=${encodeURIComponent(q)}${contactParam()}`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Busca de lugares falhou (${res.status}).`);
  const items = (await res.json()) as NominatimItem[];
  return items.map((it) => ({
    displayName: it.display_name,
    lat: Number(it.lat),
    lng: Number(it.lon),
    type: it.type,
  }));
}

/** Nome curto ("Cidade, UF") para exibir junto de coordenadas. Falha em silêncio. */
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  try {
    const url = `${BASE}/reverse?format=jsonv2&zoom=12&accept-language=pt-BR&lat=${lat}&lon=${lng}${contactParam()}`;
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as NominatimItem;
    const a = json.address ?? {};
    const place = a.village || a.town || a.city || a.municipality || a.county || a.hamlet || a.suburb;
    const region = a.state_code || a.state;
    if (place && region) return `${place}, ${region}`;
    return place || region || json.display_name?.split(",").slice(0, 2).join(",") || null;
  } catch {
    return null;
  }
}
