"use client";

import dynamic from "next/dynamic";
import type { MapPickerProps } from "./MapPicker";

/**
 * Leaflet acessa `window` na importação, então o mapa só pode ser carregado no
 * cliente. O fallback também cobre o caso offline em que o chunk do mapa ainda
 * não está em cache: o restante da tela continua utilizável.
 */
const MapPicker = dynamic<MapPickerProps>(() => import("./MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-border bg-surface-2 text-sm text-muted">
      Carregando mapa…
    </div>
  ),
});

export default MapPicker;
