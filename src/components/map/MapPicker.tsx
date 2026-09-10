"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { LatLng } from "@/lib/db/schema";
import { DEFAULT_CENTER } from "@/lib/geo/distance";

/**
 * O mapa só precisa de um ponto com nome. Manter um tipo próprio (em vez de
 * exigir FishingSpot) deixa a tela da pescaria marcar também as capturas.
 */
export interface MapMarker extends LatLng {
  id: string;
  name: string;
}

export interface MapPickerProps {
  value: LatLng | null;
  onChange?: (pos: LatLng) => void;
  spots?: MapMarker[];
  onSpotClick?: (spot: MapMarker) => void;
  /** Posição do usuário (GPS) para desenhar um ponto azul. */
  userPosition?: LatLng | null;
  interactive?: boolean;
  zoom?: number;
  className?: string;
}

// Ícones em HTML puro: evita o clássico problema de caminhos das imagens do Leaflet em bundlers.
const selectedIcon = L.divIcon({ className: "", html: '<div class="pin-marker"></div>', iconSize: [28, 28], iconAnchor: [14, 34] });
const spotIcon = L.divIcon({ className: "", html: '<div class="pin-marker pin-spot"></div>', iconSize: [22, 22], iconAnchor: [11, 27] });
const userIcon = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,.3)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function ClickHandler({ onChange }: { onChange?: (pos: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onChange?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function FlyTo({ target, zoom }: { target: LatLng | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    const current = map.getCenter();
    const dist = map.distance(current, [target.lat, target.lng]);
    if (dist > 50) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), zoom), { duration: 0.6 });
  }, [map, target, zoom]);
  return null;
}

function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    // Containers que aparecem após animações precisam recalcular o tamanho.
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export default function MapPicker({
  value,
  onChange,
  spots = [],
  onSpotClick,
  userPosition,
  interactive = true,
  zoom = 13,
  className = "",
}: MapPickerProps) {
  const center = useMemo<LatLng>(() => value ?? userPosition ?? spots[0] ?? DEFAULT_CENTER, [value, userPosition, spots]);
  const initialZoom = value || userPosition || spots.length ? zoom : 4;

  return (
    <div className={`overflow-hidden rounded-2xl border border-border ${className}`}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={initialZoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        zoomControl={interactive}
        attributionControl
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <InvalidateOnMount />
        {interactive && onChange && <ClickHandler onChange={onChange} />}
        <FlyTo target={value} zoom={zoom} />
        {userPosition && <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon} interactive={false} />}
        {spots.map((s) => (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={spotIcon}
            eventHandlers={onSpotClick ? { click: () => onSpotClick(s) } : undefined}
          >
            <Tooltip direction="top" offset={[0, -24]}>{s.name}</Tooltip>
          </Marker>
        ))}
        {value && <Marker position={[value.lat, value.lng]} icon={selectedIcon} />}
      </MapContainer>
    </div>
  );
}
