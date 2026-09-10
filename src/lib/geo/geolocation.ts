import type { LatLng } from "@/lib/db/schema";

export interface GeoFix extends LatLng {
  accuracyM: number;
  timestamp: number;
}

export class GeolocationError extends Error {}

/**
 * Uma leitura única de GPS (sem watchPosition) para poupar bateria — a
 * especificação pede localização só nos eventos relevantes.
 */
export function getCurrentPosition(opts: { timeoutMs?: number; highAccuracy?: boolean } = {}): Promise<GeoFix> {
  const { timeoutMs = 15_000, highAccuracy = true } = opts;
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new GeolocationError("Este dispositivo não oferece geolocalização."));
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      reject(new GeolocationError("Geolocalização exige HTTPS (ou localhost)."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }),
      (err) => {
        const messages: Record<number, string> = {
          1: "Permissão de localização negada. Libere nas configurações do navegador.",
          2: "Localização indisponível no momento.",
          3: "Tempo esgotado ao obter a localização.",
        };
        reject(new GeolocationError(messages[err.code] ?? "Falha ao obter a localização."));
      },
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

/** Tenta obter posição, mas nunca lança — para eventos onde o GPS é opcional. */
export async function tryGetPosition(timeoutMs = 10_000): Promise<GeoFix | null> {
  try {
    return await getCurrentPosition({ timeoutMs });
  } catch {
    return null;
  }
}
