import { useState, useMemo, useRef, useEffect } from "react";
import { MapCoordinates } from "../types";
import { MapPin, Plane, Compass, Maximize2, Globe } from "lucide-react";

interface WorldMapProps {
  locations: MapCoordinates[];
  activeLocation?: MapCoordinates | null;
  onSelectLocation?: (loc: MapCoordinates) => void;
}

export default function WorldMap({ locations, activeLocation, onSelectLocation }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [hoveredLoc, setHoveredLoc] = useState<MapCoordinates | null>(null);

  // Responsive observer for container resize, obeying Canvas/Stage sizing guidelines
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({
        width: Math.max(width, 400),
        height: Math.max(height || width * 0.5, 300)
      });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Standard equirectangular flat coordinate projection mapping
  const projectedPoints = useMemo(() => {
    const { width, height } = dimensions;
    return locations.map((loc) => {
      // Scale lat/lng to visual coordinates
      // Latitude: -90 to +90 -> maps to height to 0
      // Longitude: -180 to +180 -> maps to 0 to width
      const x = ((loc.lng + 180) * width) / 360;
      const y = ((90 - loc.lat) * height) / 180;
      return {
        ...loc,
        x,
        y
      };
    });
  }, [locations, dimensions]);

  // Find arcs (visited -> recommended matching routes)
  const travelArcs = useMemo(() => {
    const visited = projectedPoints.filter(p => p.type === 'visited');
    const recommended = projectedPoints.filter(p => p.type === 'recommended');
    const arcs: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = [];

    visited.forEach((v, i) => {
      recommended.forEach((r, j) => {
        // Connect them selectively to keep map clean and cinematic
        if ((i + j) % 3 === 0) {
          arcs.push({
            id: `arc-${v.name}-${r.name}`,
            x1: v.x,
            y1: v.y,
            x2: r.x,
            y2: r.y
          });
        }
      });
    });
    return arcs;
  }, [projectedPoints]);

  return (
    <div className="flex flex-col h-full bg-slate-950/40 rounded-2xl border border-slate-800 p-4 overflow-hidden relative" id="world-map-wrapper">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-200 tracking-tight">Geographical Intelligence Grid</h3>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse border border-amber-300/30" />
            <span className="text-slate-400">Visited</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-emerald-300/30" />
            <span className="text-slate-400">Recommended</span>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 w-full relative min-h-[300px] border border-slate-900 rounded-xl bg-slate-950/80 overflow-hidden" id="world-map-canvas-container">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

        {/* Dynamic SVG projection map overlay */}
        <svg width="100%" height="100%" className="absolute inset-0 select-none pointer-events-none">
          {/* Stylized lightweight World Map continents outlines represented as visual paths or grids */}
          <g className="opacity-10 stroke-slate-500 stroke-[0.5] fill-slate-800">
            {/* Simple representations of major landmasses to provide high-fidelity visual context */}
            {/* North America */}
            <rect x={dimensions.width * 0.12} y={dimensions.height * 0.15} width={dimensions.width * 0.22} height={dimensions.height * 0.35} rx={16} fill="transparent" stroke="currentColor" strokeDasharray="4 4" />
            <text x={dimensions.width * 0.15} y={dimensions.height * 0.2} className="text-[10px] font-mono tracking-widest text-slate-500">NORTH AMERICA</text>
            
            {/* South America */}
            <rect x={dimensions.width * 0.25} y={dimensions.height * 0.55} width={dimensions.width * 0.15} height={dimensions.height * 0.35} rx={16} fill="transparent" stroke="currentColor" strokeDasharray="4 4" />
            <text x={dimensions.width * 0.27} y={dimensions.height * 0.6} className="text-[10px] font-mono tracking-widest text-slate-500">SOUTH AMERICA</text>
            
            {/* Europe & Africa */}
            <rect x={dimensions.width * 0.45} y={dimensions.height * 0.15} width={dimensions.width * 0.22} height={dimensions.height * 0.7} rx={16} fill="transparent" stroke="currentColor" strokeDasharray="4 4" />
            <text x={dimensions.width * 0.48} y={dimensions.height * 0.25} className="text-[10px] font-mono tracking-widest text-slate-500">EUROPE & AFRICA</text>
            
            {/* Asia & India */}
            <rect x={dimensions.width * 0.68} y={dimensions.height * 0.15} width={dimensions.width * 0.25} height={dimensions.height * 0.55} rx={16} fill="transparent" stroke="currentColor" strokeDasharray="4 4" />
            <text x={dimensions.width * 0.72} y={dimensions.height * 0.2} className="text-[10px] font-mono tracking-widest text-slate-500">ASIA</text>
            
            {/* Australia */}
            <rect x={dimensions.width * 0.78} y={dimensions.height * 0.73} width={dimensions.width * 0.15} height={dimensions.height * 0.22} rx={12} fill="transparent" stroke="currentColor" strokeDasharray="4 4" />
            <text x={dimensions.width * 0.81} y={dimensions.height * 0.78} className="text-[10px] font-mono tracking-widest text-slate-500">OCEANIA</text>
          </g>

          {/* Render connecting flight/travel arcs */}
          {travelArcs.map((arc) => {
            // Curvature factor
            const dx = arc.x2 - arc.x1;
            const dy = arc.y2 - arc.y1;
            const dr = Math.sqrt(dx * dx + dy * dy) * 1.5; // Curvature height
            const pathData = `M${arc.x1},${arc.y1} A${dr},${dr} 0 0,1 ${arc.x2},${arc.y2}`;
            
            return (
              <g key={arc.id}>
                <path
                  d={pathData}
                  fill="none"
                  stroke="url(#arcGradient)"
                  strokeWidth="1.5"
                  className="opacity-40 animate-pulse-slow"
                  strokeDasharray="6 4"
                />
              </g>
            );
          })}

          {/* Gradients */}
          <defs>
            <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
            </linearGradient>
          </defs>
        </svg>

        {/* Dynamic Glowing pins using HTML absolute overlays */}
        {projectedPoints.map((point) => {
          const isVisited = point.type === 'visited';
          const isActive = activeLocation?.name === point.name || hoveredLoc?.name === point.name;
          
          return (
            <div
              key={`${point.name}-${point.type}`}
              style={{
                left: `${point.x}px`,
                top: `${point.y}px`,
                transform: 'translate(-50%, -100%)'
              }}
              onClick={() => onSelectLocation?.(point)}
              onMouseEnter={() => setHoveredLoc(point)}
              onMouseLeave={() => setHoveredLoc(null)}
              className="absolute cursor-pointer transition-all duration-300 z-10 hover:z-30 group"
              id={`map-pin-${point.name.replace(/\s+/g, '')}`}
            >
              {/* Outer Glow ripple */}
              <div className={`absolute -inset-2 rounded-full opacity-60 transition-all duration-300 ${
                isActive 
                  ? isVisited ? 'bg-amber-400 scale-150 blur' : 'bg-emerald-400 scale-150 blur'
                  : 'scale-75 group-hover:scale-100'
              }`} />

              <div className={`relative flex items-center justify-center p-1.5 rounded-lg border shadow-xl transition-all duration-300 ${
                isActive 
                  ? isVisited 
                    ? 'bg-amber-500 border-amber-300 text-slate-950 scale-110'
                    : 'bg-emerald-500 border-emerald-300 text-slate-950 scale-110'
                  : isVisited
                    ? 'bg-slate-900 border-amber-500/50 text-amber-400'
                    : 'bg-slate-900 border-emerald-500/50 text-emerald-400'
              }`}>
                {isVisited ? (
                  <Compass className={`w-3.5 h-3.5 ${isActive ? 'animate-spin' : ''}`} />
                ) : (
                  <Plane className={`w-3.5 h-3.5 ${isActive ? 'translate-x-0.5 -translate-y-0.5' : ''}`} />
                )}
                
                {/* Embedded dynamic text card when active or hovering */}
                <div className={`absolute left-1/2 bottom-full mb-2 -translate-x-1/2 bg-slate-950 text-slate-100 border border-slate-800 text-[11px] font-sans px-2.5 py-1.5 rounded-md whitespace-nowrap pointer-events-none transition-all duration-300 flex flex-col items-center gap-0.5 shadow-2xl ${
                  isActive ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-1 scale-90'
                }`}>
                  <span className="font-semibold text-slate-200">{point.name}</span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${isVisited ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    {isVisited ? 'Visited Site' : 'Tailored Recommendation'} ({point.country})
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Dynamic Watermark Map Coordinate */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-slate-950/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-900 text-[10px] font-mono text-slate-400">
          <Maximize2 className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span>CORD PROJECTION: EQUIRECTANGULAR / MERCATOR MESH</span>
        </div>
      </div>
    </div>
  );
}
