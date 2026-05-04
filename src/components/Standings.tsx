import React from 'react';
import { DriverStanding } from '../types';
import { cn } from '../lib/utils';

interface StandingsProps {
  standings: DriverStanding[];
}

export function Standings({ standings }: StandingsProps) {
  return (
    <div className="flex flex-col gap-1.5 h-full overflow-hidden">
      <div className="flex justify-between items-center px-2 py-1 bg-white/5 border-y border-white/10">
        <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest w-4 text-center">P</span>
        <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest flex-1 pl-3">Driver</span>
        <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest w-12 text-right">Int</span>
      </div>
      
      <div className="flex flex-col overflow-y-auto pr-1 space-y-1 scrollbar-hide">
        {standings.map((driver) => (
          <div 
            key={driver.id} 
            className={cn(
              "flex items-center justify-between py-1 px-1.5 rounded-sm border transition-colors relative overflow-hidden",
              driver.isPlayer 
                ? "bg-indigo-900/40 border-indigo-500/50" 
                : "bg-black/40 border-white/5 hover:bg-white/10"
            )}
          >
            {driver.isPlayer && (
               <div className="absolute top-0 left-0 bottom-0 w-8 bg-gradient-to-r from-indigo-500/20 to-transparent"></div>
            )}
            <div className="flex items-center gap-2 flex-1 min-w-0 relative z-10">
              <span className={cn(
                "w-4 font-mono text-[10px] font-bold text-center",
                driver.position === 1 ? "text-amber-400" : 
                driver.position <= 3 ? "text-slate-300" : "text-slate-500"
              )}>
                {driver.position}
              </span>
              
              <div 
                className="w-1 h-3 rounded-full shrink-0"
                style={{ backgroundColor: driver.team }}
              />
              
              <div className="flex gap-2 items-baseline truncate pl-1">
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest truncate",
                  driver.isPlayer ? "text-white drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]" : "text-slate-200"
                )}>
                  {driver.name.split(' ')[1] || driver.name}
                </span>
                {driver.penalties && driver.penalties.length > 0 && (
                  <span className="text-[7px] bg-rose-500/80 text-white px-1 py-0.5 rounded-sm font-bold shadow-[0_0_4px_rgba(244,63,94,0.5)] flex items-center shrink-0">
                    {driver.penalties.map(p => p.type === 'time' ? `+${p.amount}s` : p.type === 'drive-through' ? 'DT' : 'STOP/GO').join(', ')}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end relative z-10 w-14">
              {driver.status === 'active' ? (
                <span className="text-[10px] font-mono whitespace-nowrap text-emerald-400 font-bold overflow-hidden text-ellipsis">
                  {driver.interval}
                </span>
              ) : (
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-widest",
                  driver.status === 'pit' ? "text-amber-400" : "text-rose-500"
                )}>
                  {driver.status}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
