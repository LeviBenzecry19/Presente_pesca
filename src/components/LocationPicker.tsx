"use client";

import { useEffect, useRef, useState } from "react";
import MapPicker from "@/components/map/MapPickerLazy";
import type { MapMarker } from "@/components/map/MapPicker";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Card";
import type { FishingSpot, LatLng } from "@/lib/db/schema";
import { getCurrentPosition } from "@/lib/geo/geolocation";
import { reverseGeocode, searchPlaces, type PlaceResult } from "@/lib/geo/nominatim";
import { formatCoords } from "@/lib/utils/format";
import { useOnline } from "@/lib/hooks/useOnline";

export interface LocationValue extends LatLng {
  name?: string;
  spotId?: string;
}

export function LocationPicker({
  value,
  onChange,
  spots = [],
  mapHeight = "h-64",
}: {
  value: LocationValue | null;
  onChange: (v: LocationValue) => void;
  spots?: FishingSpot[];
  mapHeight?: string;
}) {
  const online = useOnline();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Busca com debounce (respeita o limite de 1 req/s do Nominatim).
  const activeQuery = showSearch ? query.trim() : "";
  useEffect(() => {
    if (activeQuery.length < 3) return;
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearching(true);
      try {
        setResults(await searchPlaces(activeQuery, ctrl.signal));
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [activeQuery]);
  const visibleResults = activeQuery.length >= 3 ? results : [];

  // Nome do lugar (reverse geocode) quando o ponto veio do GPS/mapa e há conexão.
  useEffect(() => {
    if (!value || value.name || !online) return;
    const ctrl = new AbortController();
    reverseGeocode(value.lat, value.lng, ctrl.signal).then((name) => {
      if (name && !ctrl.signal.aborted) onChange({ ...value, name });
    });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng, value?.name, online]);

  async function useGps() {
    setLocating(true);
    setGeoError(null);
    try {
      const fix = await getCurrentPosition();
      setUserPos(fix);
      onChange({ lat: fix.lat, lng: fix.lng });
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "Falha ao obter localização.");
    } finally {
      setLocating(false);
    }
  }

  function pickSpot(spot: MapMarker) {
    onChange({ lat: spot.lat, lng: spot.lng, name: spot.name, spotId: spot.id });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button type="button" variant="primary" onClick={useGps} loading={locating} className="flex-1" icon={<span aria-hidden>📍</span>}>
          Usar meu GPS
        </Button>
        <Button
          type="button"
          variant={showSearch ? "secondary" : "outline"}
          onClick={() => setShowSearch((s) => !s)}
          className="flex-1"
          icon={<span aria-hidden>🔎</span>}
          disabled={!online}
        >
          Buscar lugar
        </Button>
      </div>

      {geoError && <Notice tone="danger">{geoError}</Notice>}

      {showSearch && (
        <div className="relative">
          <Input
            type="search"
            inputMode="search"
            placeholder="Cidade, rio, represa, praia…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {(visibleResults.length > 0 || searching) && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-xl border border-border bg-surface shadow-lg">
              {searching && <li className="px-4 py-3 text-sm text-muted">Buscando…</li>}
              {visibleResults.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm hover:bg-brand-soft"
                    onClick={() => {
                      onChange({ lat: r.lat, lng: r.lng, name: r.displayName.split(",").slice(0, 2).join(",") });
                      setShowSearch(false);
                      setQuery("");
                    }}
                  >
                    {r.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {spots.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {spots.map((s) => {
            const active = value?.spotId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => pickSpot(s)}
                className={`shrink-0 rounded-full border-2 px-3 py-1.5 text-sm font-semibold ${
                  active ? "border-brand bg-brand-soft text-brand-strong" : "border-border bg-surface"
                }`}
              >
                📌 {s.name}
              </button>
            );
          })}
        </div>
      )}

      <div className={mapHeight}>
        <MapPicker
          value={value}
          onChange={(p) => onChange({ lat: p.lat, lng: p.lng })}
          spots={spots}
          onSpotClick={pickSpot}
          userPosition={userPos}
          className="h-full"
        />
      </div>

      <p className="text-xs text-muted">
        {value ? (
          <>
            <span className="font-semibold text-foreground">{value.name ?? "Ponto no mapa"}</span> · {formatCoords(value.lat, value.lng)}
          </>
        ) : (
          "Toque no mapa, use o GPS ou busque um lugar."
        )}
      </p>
    </div>
  );
}
