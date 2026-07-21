import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TelemetryData } from '../types';
import { cn } from '../lib/utils';

interface DashboardProps {
  data: TelemetryData[];
}

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const latest = data[data.length - 1];

  return (
    <div className="glass-panel rounded-xl p-3 h-full flex flex-col gap-3 overflow-hidden">
      <div className="flex justify-between items-center shrink-0">
        <h4 className="mono-label text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Aero Performance Analysis
        </h4>
        <div className="flex gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[8px] text-slate-500 uppercase">Balance</span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">{latest?.balance?.toFixed(1) || 0}% F</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] text-slate-500 uppercase">Efficiency</span>
            <span className="text-[10px] font-mono text-indigo-400 font-bold">{latest?.cl && latest?.cd ? (latest.cl / latest.cd).toFixed(3) : 0}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 min-h-0">
        {/* Cl / Cd Timeline */}
        <div className="pro-card rounded-lg p-2 flex flex-col">
          <span className="text-[8px] text-slate-500 uppercase mb-2 font-mono">Coefficients (Cl & Cd)</span>
          <div className="flex-1 min-h-[120px]">
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={data.slice(-50)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="timestamp" hide />
                <YAxis stroke="#444" fontSize={8} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ background: '#080808', border: '1px solid #333', fontSize: '9px' }}
                  itemStyle={{ fontSize: '9px' }}
                />
                <Line type="monotone" dataKey="cl" stroke="#818cf8" dot={false} strokeWidth={2} name="Cl (Lift)" />
                <Line type="monotone" dataKey="cd" stroke="#f43f5e" dot={false} strokeWidth={2} name="Cd (Drag)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Downforce Distribution Chart */}
        <div className="pro-card rounded-lg p-2 flex flex-col">
          <span className="text-[8px] text-slate-500 uppercase mb-2 font-mono">Downforce Load (N)</span>
          <div className="flex-1 min-h-[120px]">
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={data.slice(-50)}>
                <defs>
                  <linearGradient id="colorDf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="timestamp" hide />
                <YAxis stroke="#444" fontSize={8} axisLine={false} tickLine={false} />
                <Tooltip 
                   contentStyle={{ background: '#080808', border: '1px solid #333', fontSize: '9px' }}
                   itemStyle={{ fontSize: '9px' }}
                />
                <Area type="monotone" dataKey="downforce" stroke="#10b981" fillOpacity={1} fill="url(#colorDf)" strokeWidth={1} name="Total DF" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lap Time Chart */}
        <div className="pro-card rounded-lg p-2 flex flex-col">
          <span className="text-[8px] text-slate-500 uppercase mb-2 font-mono">Lap Time (s)</span>
          <div className="flex-1 min-h-[120px]">
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={data.slice(-50)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(val) => new Date(val).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
                  stroke="#444" 
                  fontSize={8} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <YAxis 
                  stroke="#444" 
                  fontSize={8} 
                  axisLine={false} 
                  tickLine={false} 
                  domain={['auto', 'auto']}
                  tickFormatter={(val) => val.toFixed(1)}
                />
                <Tooltip 
                  contentStyle={{ background: '#080808', border: '1px solid #333', fontSize: '9px' }}
                  itemStyle={{ fontSize: '9px' }}
                  labelFormatter={(label) => new Date(label).toLocaleTimeString()}
                  formatter={(value: number) => [`${value.toFixed(2)}s`, 'Lap Time']}
                />
                <Line type="monotone" dataKey="lapTime" stroke="#f59e0b" dot={false} strokeWidth={2} name="Lap Time" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Distribution Bars */}
      <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-2 shrink-0">
         <DistributionBar label="FRONT AXLE" value={latest?.balance || 50} color="bg-indigo-500" />
         <DistributionBar label="REAR AXLE" value={100 - (latest?.balance || 50)} color="bg-rose-500" />
         <div className="flex flex-col justify-center">
            <div className="flex justify-between text-[8px] font-mono mb-1">
               <span className="text-slate-500">AERO STABILITY</span>
               <span className="text-white">{Math.max(0, 100 - (latest?.instability || 0) * 100).toFixed(1)}%</span>
            </div>
            <div className="h-1 bg-slate-900/80 rounded-full overflow-hidden">
               <div className={cn("h-full transition-all duration-300", 
                 (latest?.instability || 0) > 0.4 ? "bg-red-500" : "bg-emerald-500")} 
                 style={{ width: `${Math.max(0, 100 - (latest?.instability || 0) * 100)}%` }} />
            </div>
         </div>
      </div>
    </div>
  );
};

const DistributionBar = ({ label, value, color }: { label: string, value?: number, color: string }) => (
  <div className="flex flex-col">
    <div className="flex justify-between text-[8px] font-mono mb-1">
      <span className="text-slate-500 uppercase">{label}</span>
      <span className="text-white">{value?.toFixed(1)}%</span>
    </div>
    <div className="h-1 bg-slate-900/80 rounded-full overflow-hidden">
      <div className={cn("h-full transition-all duration-500", color)} style={{ width: `${value}%` }} />
    </div>
  </div>
);

const MetricCard = ({ label, value, unit, icon, color }: { label: string, value: string | number, unit: string, icon: React.ReactNode, color: string }) => (
  <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
    <div className="flex justify-between items-center mb-2">
      <span className="text-[10px] font-mono text-neutral-500 tracking-widest uppercase">{label}</span>
      <div className={color}>{icon}</div>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-2xl font-bold tracking-tighter">{value}</span>
      <span className="text-[10px] font-mono text-neutral-500 uppercase">{unit}</span>
    </div>
  </div>
);

const BalanceRow = ({ label, value, active }: { label: string, value: number, active?: boolean }) => (
  <div>
    <div className="flex justify-between text-[10px] font-mono text-neutral-400 mb-1">
      <span>{label}</span>
      <span>{value}%</span>
    </div>
    <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
      <div 
        className={cn("h-full transition-all duration-500", active ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-neutral-500")} 
        style={{ width: `${value}%` }} 
      />
    </div>
  </div>
);
