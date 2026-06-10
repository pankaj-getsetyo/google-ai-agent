import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapCoordinates } from "../types";
import { Globe } from "lucide-react";

interface WorldMapProps {
  locations: MapCoordinates[];
  activeLocation?: MapCoordinates | null;
  onSelectLocation?: (loc: MapCoordinates) => void;
}

function createPinIcon(type: "visited" | "recommended", isActive: boolean): L.DivIcon {
  const isVisited = type === "visited";
  const bg = isActive
    ? isVisited ? "#cfa867" : "#7f8f72"
    : isVisited ? "#14120e" : "#14120e";
  const border = isVisited ? "#cfa867" : "#7f8f72";
  const inner = isActive ? "#14120e" : isVisited ? "#cfa867" : "#7f8f72";

  return L.divIcon({
    className: "travel-map-pin",
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: ${bg};
        border: 2px solid ${border};
        box-shadow: 0 4px 14px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
        ${isActive ? "transform: rotate(-45deg) scale(1.15);" : ""}
      ">
        <span style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${inner};
          transform: rotate(45deg);
          display: block;
        "></span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });
}

export default function WorldMap({ locations, activeLocation, onSelectLocation }: WorldMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const onSelectRef = useRef(onSelectLocation);
  onSelectRef.current = onSelectLocation;

  // Init map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Sync markers + bounds when locations change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    if (locations.length === 0) {
      map.setView([20, 0], 2);
      return;
    }

    const bounds = L.latLngBounds([]);

    locations.forEach((loc) => {
      const key = `${loc.name}-${loc.type}`;
      const isActive = activeLocation?.name === loc.name && activeLocation?.type === loc.type;

      const marker = L.marker([loc.lat, loc.lng], {
        icon: createPinIcon(loc.type, isActive),
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: Inter, system-ui, sans-serif; min-width: 140px;">
          <div style="font-weight: 600; font-size: 14px; color: #1c1917; margin-bottom: 2px;">${loc.name}</div>
          <div style="font-size: 12px; color: #78716c;">
            ${loc.type === "visited" ? "Visited" : "Suggested"} · ${loc.country}
          </div>
        </div>
      `);

      marker.on("click", () => onSelectRef.current?.(loc));
      markersRef.current.set(key, marker);
      bounds.extend([loc.lat, loc.lng]);
    });

    if (locations.length === 1) {
      map.setView([locations[0].lat, locations[0].lng], 5);
    } else {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 6 });
    }
  }, [locations, activeLocation]);

  // Pan to active location when selected from elsewhere
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeLocation) return;

    map.flyTo([activeLocation.lat, activeLocation.lng], Math.max(map.getZoom(), 5), {
      duration: 0.8,
    });

    const key = `${activeLocation.name}-${activeLocation.type}`;
    const marker = markersRef.current.get(key);
    marker?.openPopup();
  }, [activeLocation]);

  return (
    <div
      className="flex flex-col h-full bg-white/[0.02] rounded-3xl border border-white/[0.06] p-5 overflow-hidden relative"
      id="world-map-wrapper"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Globe className="w-5 h-5 text-brass-300" strokeWidth={1.5} />
          <h3 className="font-display text-lg font-light text-stone-100 tracking-tight">Your travel map</h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brass-400" />
            <span className="text-stone-400">Visited</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sage-500" />
            <span className="text-stone-400">Suggested</span>
          </div>
        </div>
      </div>

      <div
        ref={mapContainerRef}
        className="flex-1 w-full min-h-[360px] md:min-h-[420px] rounded-2xl overflow-hidden border border-white/[0.06] z-0"
        id="world-map-canvas-container"
      />
    </div>
  );
}
