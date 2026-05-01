import React, { useRef, useEffect, useState } from 'react';
import { Maximize2, Minimize2, Info } from 'lucide-react';
import { cn } from '../lib/utils';

// Standardized closed loop F1 track paths
const TRACK_PATHS: Record<string, string> = {
  Silverstone: 'M30,80 C10,70 10,50 30,40 C50,30 30,10 60,10 C90,10 90,30 70,50 C50,70 90,90 60,90 C40,90 50,90 30,80 Z',
  Monza: 'M20,50 C20,10 80,10 80,50 C80,90 20,90 20,50 Z',
  Monaco: 'M20,60 C10,40 30,20 50,30 C70,40 90,60 80,80 C70,100 40,80 30,70 C20,60 10,70 20,60 Z',
  Spa: 'M30,20 C50,0 70,20 80,40 C90,60 70,100 50,80 C30,60 10,40 30,20 Z',
  Interlagos: 'M40,20 C70,10 90,40 70,70 C50,100 10,80 20,50 C30,20 10,30 40,20 Z',
  Suzuka: 'M20,80 C10,50 50,40 60,40 C90,40 90,10 70,10 C50,10 40,30 50,50 C60,70 90,90 70,100 C50,110 30,110 20,80 Z', 
};

type ZoneType = 'braking' | 'drs' | 'fast' | 'slow' | 'flatOut';
const ZONE_COLORS = {
  braking: 'rgba(239,68,68,0.8)', // red
  drs: 'rgba(168,85,247,0.8)',    // vibrant purple
  fast: 'rgba(59,130,246,0.8)',   // blue
  slow: 'rgba(245,158,11,0.8)',   // orange
  flatOut: 'rgba(16,185,129,0.8)', // green
};

const DEFAULT_ZONES: { start: number, end: number, type: ZoneType }[] = [
  { start: 5, end: 15, type: 'drs' },
  { start: 15, end: 20, type: 'braking' },
  { start: 30, end: 40, type: 'fast' },
  { start: 40, end: 45, type: 'slow' },
  { start: 55, end: 70, type: 'flatOut' },
  { start: 70, end: 78, type: 'braking' },
  { start: 85, end: 95, type: 'fast' },
];

export function TrackMap({ track, active, speed, className }: { track: string, active: boolean, speed: number, className?: string }) {
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGGElement>(null);
  const activeLineRef = useRef<SVGPathElement>(null);
  const progressRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const speedRef = useRef(speed);
  
  const [expanded, setExpanded] = useState(false);
  const [showZones, setShowZones] = useState(true);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    let animationFrame: number;
    
    const setInitPosition = () => {
      if (pathRef.current && dotRef.current) {
        progressRef.current = 0;
        const p = pathRef.current.getPointAtLength(0);
        dotRef.current.setAttribute('transform', `translate(${p.x}, ${p.y})`);
      }
    };
    
    if (!active) {
      setTimeout(setInitPosition, 100); 
    }

    const updatePosition = (time: number) => {
      if (!active) {
        lastTimeRef.current = time;
        animationFrame = requestAnimationFrame(updatePosition);
        return;
      }
        
      const dt = time - lastTimeRef.current;
      lastTimeRef.current = time;
      
      if (pathRef.current) {
        const pathLength = pathRef.current.getTotalLength();
        if (pathLength > 0) {
          progressRef.current += (speedRef.current * 0.00003) * (dt / 16.6);
          if (progressRef.current > 1) {
            progressRef.current %= 1;
          }
          
          const p = pathRef.current.getPointAtLength(progressRef.current * pathLength);
          if (dotRef.current) {
            dotRef.current.setAttribute('transform', `translate(${p.x}, ${p.y})`);
          }
          if (activeLineRef.current) {
            // Dash around the entire path, flowing according to progress
            activeLineRef.current.setAttribute('stroke-dashoffset', String(-progressRef.current * 100));
          }
        }
      }
      animationFrame = requestAnimationFrame(updatePosition);
    };
    
    animationFrame = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(animationFrame);
  }, [active, track, expanded]);

  const pathD = TRACK_PATHS[track] || TRACK_PATHS['Silverstone'];

  const content = (
    <>
      <button 
        onClick={() => setExpanded(!expanded)} 
        className="absolute top-2 right-2 p-1.5 bg-white/5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors z-20"
      >
        {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>

      {expanded && (
        <div className="absolute top-2 left-2 z-20 flex bg-white/5 rounded backdrop-blur-md border border-white/10 p-1">
          <button 
            onClick={() => setShowZones(!showZones)}
            className={cn("px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded transition-colors", showZones ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:text-white")}
          >
            Telemetry Zones
          </button>
        </div>
      )}

      <svg viewBox="0 0 100 110" className={cn("overflow-visible transition-all duration-300", expanded ? "w-full h-full max-h-[80vh]" : "w-[80%] h-[80%]")}>
        {/* Track base outline */}
        <path 
          d={pathD} 
          fill="none" 
          stroke="rgba(255,255,255,0.1)" 
          strokeWidth={expanded ? "3" : "4"} 
          strokeLinecap="round"
          strokeLinejoin="round" 
        />

        {/* Dynamic Active Racing Line (Dashed) */}
        {active && (
          <path
            ref={activeLineRef}
            d={pathD}
            pathLength="100"
            fill="none"
            stroke="#10b981"
            strokeWidth={expanded ? "1" : "2"}
            strokeDasharray="1 3"
            strokeLinecap="round"
            className="opacity-60"
          />
        )}

        {/* Telemetry Zones */}
        {showZones && expanded && DEFAULT_ZONES.map((zone, i) => {
          const length = zone.end - zone.start;
          const dashArray = `${length} ${100 - length}`;
          const dashOffset = -zone.start; 
          return (
            <path
              key={i}
              d={pathD}
              pathLength="100"
              fill="none"
              stroke={ZONE_COLORS[zone.type]}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              className="opacity-70 transition-opacity duration-500"
            />
          );
        })}

        {/* Invisible main path used for calculating length/points */}
        <path 
          ref={pathRef}
          d={pathD} 
          fill="none" 
          stroke="none" 
        />
        
        {/* Car Position Dot */}
        <g ref={dotRef} transform={`translate(-10, -10)`}>
          <circle cx="0" cy="0" r="3" fill="#10b981" />
          {active && <circle cx="0" cy="0" r="6" fill="rgba(16,185,129,0.3)" className="animate-ping" />}
        </g>
      </svg>
      {/* Label indicating track and position tracking */}
      {!expanded && (
        <div className="absolute bottom-2 left-0 right-0 text-center">
          <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">{track}</span>
        </div>
      )}

      {expanded && showZones && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4 flex-wrap px-4">
          <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
            <span className="text-[9px] font-bold text-slate-300 uppercase">DRS Active</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            <span className="text-[9px] font-bold text-slate-300 uppercase">Flat Out</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-[9px] font-bold text-slate-300 uppercase">Heavy Braking</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-[9px] font-bold text-slate-300 uppercase">High Speed Corner</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span className="text-[9px] font-bold text-slate-300 uppercase">Slow Traction</span>
          </div>
        </div>
      )}
    </>
  );

  return expanded ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]/95 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl aspect-video flex flex-col items-center justify-center">
        <h2 className="absolute top-4 font-display text-4xl font-black text-white/10 uppercase tracking-widest pointer-events-none">
          {track} <span className="text-emerald-500/20">Circuit</span>
        </h2>
        {content}
      </div>
    </div>
  ) : (
    <div className={cn("relative w-full h-full flex flex-col items-center justify-center p-2", className)}>
      {content}
    </div>
  );
}
