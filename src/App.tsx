/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { WindTunnel } from './components/WindTunnel';
import { Dashboard } from './components/Dashboard';
import { TrackMap } from './components/TrackMap';
import { Standings } from './components/Standings';
import { TelemetryData, AeroSetup, SimulationState, TuningAdvice, DriverStanding, TireType } from './types';
import { getAeroAdvice } from './services/geminiService';
import { 
  Sparkles,
  Save,
  Timer,
  Wrench,
  Cpu
} from 'lucide-react';
import { cn } from './lib/utils';

const trackCoords: Record<string, { lat: number, lon: number }> = {
  Silverstone: { lat: 52.0786, lon: -1.0169 },
  Monza: { lat: 45.6156, lon: 9.2811 },
  Monaco: { lat: 43.7347, lon: 7.4206 },
  Spa: { lat: 50.4372, lon: 5.9714 },
  Interlagos: { lat: -23.7036, lon: -46.6997 },
  Suzuka: { lat: 34.8431, lon: 136.5410 }
};

export default function App() {
  const [telemetry, setTelemetry] = useState<TelemetryData[]>([]);
  const [setup, setSetup] = useState<AeroSetup>({
    frontWingAngle: 12,
    rearWingAngle: 18,
    rideHeight: 35,
    brakeBalance: 52,
    tirePressure: 21,
    tireType: 'Soft'
  });
  
  const [savedSetups, setSavedSetups] = useState<Record<string, AeroSetup>>({
    'Formula 1': {
      frontWingAngle: 12,
      rearWingAngle: 18,
      rideHeight: 35,
      brakeBalance: 52,
      tirePressure: 21,
      tireType: 'Soft'
    },
    'Hypercar': {
      frontWingAngle: 8,
      rearWingAngle: 12,
      rideHeight: 50,
      brakeBalance: 55,
      tirePressure: 23,
      tireType: 'Medium'
    },
    'GT3': {
      frontWingAngle: 5,
      rearWingAngle: 8,
      rideHeight: 65,
      brakeBalance: 58,
      tirePressure: 25,
      tireType: 'Hard'
    }
  });
  const [simState, setSimState] = useState<SimulationState>({
    isActive: false,
    isMultiplayer: false,
    weather: 'Sunny',
    track: 'Silverstone',
    ersMode: 'neutral',
    carModel: 'Formula 1'
  });
  const [trackWeather, setTrackWeather] = useState({
    temp: '32.4°C',
    humidity: '68%',
    windSpeed: '14 km/h',
    heading: 'NE'
  });
  const [aiAdvice, setAiAdvice] = useState<TuningAdvice | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [standings, setStandings] = useState<DriverStanding[]>([
    { id: '1', position: 1, name: 'Max Verstappen', number: 1, team: '#1e41ff', gap: 'Leader', interval: 'Leader', lap: 42, status: 'active' },
    { id: '2', position: 2, name: 'Lando Norris', number: 4, team: '#ff8700', gap: '+1.432s', interval: '+1.432s', lap: 42, status: 'active' },
    { id: 'usr', position: 3, name: 'Player One', number: 99, team: '#10b981', gap: '+2.105s', interval: '+0.673s', lap: 42, status: 'active', isPlayer: true },
    { id: '3', position: 4, name: 'Lewis Hamilton', number: 44, team: '#00d2be', gap: '+4.551s', interval: '+2.446s', lap: 42, status: 'active' },
    { id: '4', position: 5, name: 'Fernando Alonso', number: 14, team: '#006f62', gap: '+12.4s', interval: '+7.849s', lap: 42, status: 'pit' },
    { id: '5', position: 6, name: 'Charles Leclerc', number: 16, team: '#e80020', gap: '+15.2s', interval: '+2.8s', lap: 42, status: 'active' },
    { id: '6', position: 7, name: 'Carlos Sainz', number: 55, team: '#e80020', gap: '+16.5s', interval: '+1.3s', lap: 42, status: 'active' },
    { id: '7', position: 8, name: 'George Russell', number: 63, team: '#00d2be', gap: '+19.1s', interval: '+2.6s', lap: 42, status: 'active' },
    { id: '8', position: 9, name: 'Oscar Piastri', number: 81, team: '#ff8700', gap: '+22.4s', interval: '+3.3s', lap: 42, status: 'active' },
    { id: '9', position: 10, name: 'Lance Stroll', number: 18, team: '#006f62', gap: '+29.0s', interval: '+6.6s', lap: 42, status: 'active' },
    { id: '10', position: 11, name: 'Yuki Tsunoda', number: 22, team: '#2b4562', gap: 'OUT', interval: 'OUT', lap: 12, status: 'out' },
  ]);

  useEffect(() => {
    const fetchWeather = async () => {
      const coords = trackCoords[simState.track] || trackCoords['Silverstone'];
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true&hourly=relative_humidity_2m`);
        const data = await res.json();
        const current = data.current_weather;
        let humidity = 68;
        if (data.hourly && data.hourly.relative_humidity_2m) {
          // just taking the first hour's humidity as approximation
          humidity = data.hourly.relative_humidity_2m[0] || 68;
        }
        
        const windDir = current.winddirection;
        const getHeading = (dir: number) => {
          const val = Math.floor((dir / 22.5) + 0.5);
          const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
          return arr[(val % 16)];
        };

        setTrackWeather({
          temp: `${current.temperature}°C`,
          humidity: `${humidity}%`,
          windSpeed: `${current.windspeed} km/h`,
          heading: getHeading(windDir)
        });
      } catch (e) {
        console.error("Weather fetch error", e);
      }
    };
    fetchWeather();
  }, [simState.track]);

  const [sessionElapsedMs, setSessionElapsedMs] = useState<number>(0);
  const sessionStartTimeRef = useRef<number | null>(null);
  const [realClock, setRealClock] = useState('00:00:00.000 UTC');

  useEffect(() => {
    const int = setInterval(() => {
      const ms = Date.now();
      const date = new Date(ms);
      setRealClock(`${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}:${date.getUTCSeconds().toString().padStart(2, '0')}.${Math.floor((ms % 1000) / 10).toString().padStart(2, '0')} UTC`);
    }, 50);
    return () => clearInterval(int);
  }, []);

  useEffect(() => {
    if (simState.isActive) {
      sessionStartTimeRef.current = Date.now() - sessionElapsedMs;
      const interval = setInterval(() => {
        if (sessionStartTimeRef.current) {
          setSessionElapsedMs(Date.now() - sessionStartTimeRef.current);
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [simState.isActive]);

  const formatSessionTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${Math.floor(milliseconds / 10).toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${Math.floor(milliseconds / 10).toString().padStart(2, '0')}`;
  };

  const handleTelemetryUpdate = useCallback((newData: Partial<TelemetryData>) => {
    setTelemetry(prev => {
      const updated = [...prev, { ...newData, timestamp: Date.now() } as TelemetryData];
      return updated.slice(-100); // Keep last 100 points
    });
  }, []);

  const latest = telemetry[telemetry.length - 1];

  useEffect(() => {
    const socket = io();
    
    socket.on('telemetry:stream', (data: TelemetryData) => {
      // Prioritize "real" telemetry from server if session is active
      if (simState.isActive) {
        handleTelemetryUpdate(data);
      }
    });

    socket.on('standings:update', (data: DriverStanding[]) => {
      if (simState.isActive) {
        setStandings(data);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [simState.isActive, handleTelemetryUpdate]);

  // Mock real-time standings progression if active
  useEffect(() => {
    if (!simState.isActive) return;

    const interval = setInterval(() => {
      setStandings(prev => {
        // 1. Calculate base total gap to leader for accurate tracking
        let currentGapToLeader = 0;
        const driverGaps = prev.map((d, index) => {
           let totalGap = 0;
           if (index === 0) {
             totalGap = 0;
           } else if (d.status !== 'active') {
             totalGap = Infinity;
           } else {
             let intervalSec = parseFloat(d.interval.replace('+', '').replace('s', ''));
             if (isNaN(intervalSec)) intervalSec = 0;
             currentGapToLeader += intervalSec;
             totalGap = currentGapToLeader;
           }
           return { ...d, totalGap };
        });

        // 2. Apply natural changes and random AI penalties
        const updated = driverGaps.map(driver => {
          if (driver.position === 1 && driver.totalGap === 0) return driver; // leader
          if (driver.status !== 'active') return driver;

          // random small change in gap
          const timeChange = (Math.random() - 0.5) * 0.1;
          driver.totalGap += timeChange;

          // Apply AI Penalty logic
          let newPenalties = [...(driver.penalties || [])];
          // Slightly higher probability to see them more often during simulation, but still rare
          if (!driver.isPlayer && Math.random() < 0.008 && newPenalties.length < 2) {
             const rand = Math.random();
             let type: 'time' | 'drive-through' | 'stop-go' = 'time';
             let amount = 5;
             let reason = 'Track Limits';

             if (rand > 0.95) {
               type = 'stop-go';
               amount = 30; // 30s for Stop-Go
               reason = 'Ignoring Yellow Flags';
             } else if (rand > 0.8) {
               type = 'drive-through';
               amount = 20; // 20s for Drive-Through
               reason = 'Pit Lane Speeding';
             } else if (rand > 0.4) {
               type = 'time';
               amount = 10;
               reason = 'Causing a Collision';
             }

             newPenalties.push({ type, amount, reason });
             driver.totalGap += amount; // Apply penalty to total gap directly for effect
          }
          
          return {
            ...driver,
            penalties: newPenalties
          };
        });

        // 3. Sort by total gap
        updated.sort((a, b) => {
           if (a.status !== 'active' && b.status !== 'active') return 0;
           if (a.status !== 'active') return 1;
           if (b.status !== 'active') return -1;
           return a.totalGap - b.totalGap;
        });

        // 4. Re-assign positions and recalculate correct intervals
        let prevGap = 0;
        return updated.map((d, index) => {
           if (d.status !== 'active') {
             return { ...d, position: index + 1 };
           }
           if (index === 0) {
             prevGap = d.totalGap;
             // Remove totalGap from final object
             const { totalGap, ...rest } = d as any;
             return { ...rest, position: 1, gap: 'Leader', interval: 'Leader' };
           }
           const intervalValue = d.totalGap - prevGap;
           prevGap = d.totalGap;
           const { totalGap, ...rest } = d as any;
           return { 
             ...rest, 
             position: index + 1,
             gap: `+${d.totalGap.toFixed(3)}s`,
             interval: `+${Math.max(0, intervalValue).toFixed(3)}s`
           };
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [simState.isActive]);

  const [pitState, setPitState] = useState<{
    status: 'none' | 'requested' | 'pitting' | 'completed';
    scheduledTire?: TireType;
    repairs?: boolean;
    timer?: number; // count up or duration
  }>({ status: 'none' });
  const [showPitMenu, setShowPitMenu] = useState(false);
  const [pitConfig, setPitConfig] = useState<{ tire: TireType, repairs: boolean }>({ tire: 'Medium', repairs: false });

  const [drsState, setDrsState] = useState<{
    available: boolean;
    active: boolean;
    autoEnable: boolean;
  }>({ available: false, active: false, autoEnable: true });

  // DRS AI logic
  useEffect(() => {
    if (!simState.isActive) {
      if (drsState.active || drsState.available) {
        setDrsState(s => ({ ...s, active: false, available: false }));
      }
      return;
    }

    const intervalId = setInterval(() => {
      const playerIndex = standings.findIndex(d => d.isPlayer);
      if (playerIndex > 0) {
        const gapString = standings[playerIndex].interval;
        const gapSeconds = parseFloat(gapString.replace('+', '').replace('s', ''));
        
        // Using > 220 as a threshold for "on a straight"
        const isStraight = (latest?.speed || 0) > 220;
        const isEligible = !isNaN(gapSeconds) && gapSeconds < 1.0 && gapSeconds > 0 && standings[playerIndex].status === 'active';
        
        if (isEligible && isStraight) {
          setDrsState(prev => {
            if (!prev.available) {
              return { ...prev, available: true, active: prev.autoEnable };
            }
            return prev;
          });
        } else {
          setDrsState(prev => {
            if (prev.available || prev.active) {
              return { ...prev, available: false, active: false };
            }
            return prev;
          });
        }
      } else {
        setDrsState(prev => prev.available || prev.active ? { ...prev, available: false, active: false } : prev);
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [simState.isActive, standings, latest?.speed, drsState.autoEnable]);

  const triggerPitStop = (tireType: TireType, repairs: boolean) => {
    if (pitState.status !== 'none' || !simState.isActive) return;
    
    setPitState({ status: 'requested', scheduledTire: tireType, repairs });
    
    // Simulate lap completion before pitting
    setTimeout(() => {
      setPitState({ status: 'pitting', scheduledTire: tireType, repairs, timer: 0 });
      setStandings(prev => prev.map(d => d.isPlayer ? { ...d, status: 'pit' } : d));
      
      const pitDuration = 2500 + (repairs ? 1500 : 0) + (Math.random() * 800);
      const startTime = Date.now();
      
      const timerInterval = setInterval(() => {
        setPitState(s => ({ ...s, timer: Date.now() - startTime }));
      }, 50);
      
      setTimeout(() => {
        clearInterval(timerInterval);
        setPitState({ status: 'completed' });
        setSetup(s => ({ ...s, tireType })); // Apply tires
        
        // Return to track, adjust interval to simulate time lost in pits
        setStandings(prev => prev.map(d => {
          if (d.isPlayer) {
            const currentIntervalSeconds = parseFloat(d.interval.replace('+', '').replace('s', '')) || 0;
            return {
              ...d,
              status: 'active',
              interval: `+${(currentIntervalSeconds + 22.4).toFixed(3)}s`
            };
          }
          return d;
        }));
        
        setTimeout(() => setPitState({ status: 'none' }), 3000);
      }, pitDuration);
    }, 3000); // 3 seconds "in lap"
  };

  const [aiAdviceError, setAiAdviceError] = useState<string | null>(null);

  const handleCarModelChange = (model: 'Formula 1' | 'Hypercar' | 'GT3') => {
    setSimState(s => ({ ...s, carModel: model }));
    if (savedSetups[model]) {
      setSetup(savedSetups[model]);
    }
  };

  const handleSaveConfig = () => {
    const model = simState.carModel || 'Formula 1';
    setSavedSetups(prev => ({
      ...prev,
      [model]: { ...setup }
    }));
  };

  const requestAiAdvice = async () => {
    setIsAiLoading(true);
    setAiAdviceError(null);
    try {
      const advice = await getAeroAdvice(telemetry, setup);
      setAiAdvice(advice);
    } catch (err: any) {
      setAiAdviceError(err.message || String(err));
    } finally {
      setIsAiLoading(false);
    }
  };

  const applySuggestions = () => {
    if (!aiAdvice) return;
    
    const targetSetup = aiAdvice.suggestions;
    const startSetup = { ...setup };
    const duration = 1500; // ms transition duration
    const startTime = performance.now();

    const animateSetup = (time: number) => {
      let t = (time - startTime) / duration;
      if (t > 1) t = 1;
      
      // smooth ease-out quadratic
      const easeOut = 1 - (1 - t) * (1 - t);

      setSetup(prev => {
        const next = { ...prev };
        (Object.keys(targetSetup) as Array<keyof AeroSetup>).forEach(key => {
          const startVal = startSetup[key];
          const targetVal = targetSetup[key];
          if (typeof startVal === 'number' && typeof targetVal === 'number') {
            (next as any)[key] = startVal + (targetVal - startVal) * easeOut;
          }
        });
        return next;
      });

      if (t < 1) {
        requestAnimationFrame(animateSetup);
      }
    };

    requestAnimationFrame(animateSetup);
    setAiAdvice(null);
  };

  return (
    <div className="w-full h-screen bg-[#050505] text-slate-300 font-sans flex flex-col overflow-hidden">
      {/* TOP NAV BAR */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-[#0a0a0a] shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]", simState.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-600")}></div>
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-white tracking-widest font-display">AeroStream v4.2 // F1-Live</span>
          </div>
          <div className="h-6 w-[1px] bg-white/10"></div>
          <div className="flex gap-4">
            <HeaderMetric label="Chassis" value="AMR-24 SPEC-C" />
            <HeaderMetric label="Circuit" value={simState.track} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={cn("px-3 py-1 flex items-center gap-2 border rounded text-[10px] font-bold uppercase transition-colors shadow-inner", 
            simState.isActive ? "bg-[#050505] border-emerald-500/30 text-emerald-400" : "bg-[#050505] border-white/10 text-slate-500")}
          >
            <Timer className={cn("w-3 h-3", simState.isActive && "animate-pulse")} />
            {formatSessionTime(sessionElapsedMs)}
          </div>
          <div className={cn("px-3 py-1 border rounded text-[10px] font-bold uppercase transition-colors", simState.isActive ? "bg-rose-500/10 border-rose-500/20 text-rose-500" : "bg-white/5 border-white/10 text-slate-500")}>
            {simState.isActive ? 'Telemetry Active' : 'Standby'}
          </div>
          <div className="text-xs font-mono text-slate-400 w-[110px] text-right">{realClock}</div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* LEFT SIDEBAR: LIVE FEED */}
        <aside className="w-64 border-r border-white/10 bg-[#080808] p-4 flex flex-col gap-4 overflow-hidden shrink-0">
          <div>
            <h3 className="mono-label mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Telemetry</h3>
            <div className="space-y-1.5">
              <TelemetryRow label="VELOCITY" value={`${latest?.speed?.toFixed(1) || 0} km/h`} color="text-emerald-400" />
              <TelemetryRow label="DOWNFORCE" value={`${latest?.downforce?.toFixed(0) || 0} N`} color="text-emerald-400" />
              <TelemetryRow label="GEAR" value="7" color="text-white" />
              <div className="space-y-1 mt-2">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">ERS CHARGE</span>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, latest?.ers || 100))}%` }}></div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setSimState(s => ({ ...s, ersMode: s.ersMode === 'regen' ? 'neutral' : 'regen' }))}
                    className={cn("flex-1 py-1 text-[9px] font-bold rounded uppercase transition-colors border", simState.ersMode === 'regen' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10")}
                  >
                    Regen
                  </button>
                  <button 
                    onClick={() => setSimState(s => ({ ...s, ersMode: s.ersMode === 'boost' ? 'neutral' : 'boost' }))}
                    className={cn("flex-1 py-1 text-[9px] font-bold rounded uppercase transition-colors border", simState.ersMode === 'boost' ? "bg-rose-500/20 text-rose-400 border-rose-500/50" : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10")}
                  >
                    Boost
                  </button>
                </div>
              </div>

              <div className="space-y-1 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">DRS SYSTEM</span>
                  <button 
                     onClick={() => setDrsState(s => ({ ...s, autoEnable: !s.autoEnable }))}
                     className={cn("text-[8px] px-1.5 py-0.5 rounded font-bold uppercase", drsState.autoEnable ? "bg-indigo-500/20 text-indigo-400" : "bg-white/10 text-slate-400")}
                  >
                     Auto
                  </button>
                </div>
                <div className="flex gap-2 pt-1">
                  <button 
                    disabled={!drsState.available}
                    onClick={() => !drsState.autoEnable && setDrsState(s => ({ ...s, active: !s.active }))}
                    className={cn(
                      "w-full py-1.5 text-[10px] font-bold rounded uppercase transition-all border flex items-center justify-center gap-2",
                      !drsState.available 
                        ? "bg-[#050505] border-white/5 text-slate-600 opacity-50 cursor-not-allowed" 
                        : drsState.active
                          ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse"
                          : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                    )}
                  >
                    {drsState.active ? "DRS OPEN" : drsState.available ? "DRS AVAILABLE" : "DRS UNAVAILABLE"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="mono-label mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Health</h3>
            <div className="space-y-2">
              <HealthStatus label="GPU ACCELERATION: ACTIVE" status="ok" />
              <HealthStatus label="SOLVER FREQ: 2000Hz" status="ok" />
              <HealthStatus label="LATENCY: 14ms (WARN)" status="warn" />
            </div>
          </div>

          <div className="mt-4">
            <h3 className="mono-label mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">AI Tuning Suggestions</h3>
            <div className={cn(
              "p-3 rounded-lg border transition-all duration-500",
              aiAdvice ? "bg-indigo-600/10 border-indigo-500/30" : aiAdviceError ? "bg-rose-500/10 border-rose-500/30" : "bg-white/5 border-white/5"
            )}>
              {aiAdviceError ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-rose-400">Tuning Error</p>
                  <p className="text-[9px] text-rose-300 break-words">{aiAdviceError}</p>
                </div>
              ) : aiAdvice ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-500 uppercase">Analysis</p>
                    <p className="text-[10px] leading-tight text-slate-300">{aiAdvice.analysis}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-500 uppercase">Changes</p>
                    <div className="grid grid-cols-2 gap-1 px-1">
                      {Object.entries(aiAdvice.suggestions).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-[9px] font-mono">
                          <span className="text-slate-500">{key.slice(0, 4).toUpperCase()}</span>
                          <span className="text-emerald-400">→ {value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={applySuggestions}
                    className="w-full py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-[9px] font-bold uppercase rounded transition-colors"
                  >
                    Apply Modifications
                  </button>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <Cpu className={cn("w-6 h-6 mx-auto mb-2 text-slate-700", isAiLoading && "animate-pulse text-indigo-500")} />
                  <p className="text-[9px] text-slate-600 uppercase tracking-tighter italic">
                    {isAiLoading ? "Analyzing Flow Patterns..." : "Awaiting Simulation Data"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* MAIN VISUALIZER AREA */}
        <main className="flex-1 flex flex-col bg-[#050505] p-4 gap-4 min-w-0">
          <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl relative overflow-hidden flex items-center justify-center shadow-inner">
            <WindTunnel 
              setup={setup} 
              isSimulating={simState.isActive} 
              ersMode={simState.ersMode}
              carModel={simState.carModel}
              drsActive={drsState.active}
              onTelemetryUpdate={handleTelemetryUpdate} 
              latestTelemetry={latest}
            />
          </div>

          {/* BOTTOM DATA STRIP */}
          <div className="h-44 shrink-0 flex gap-4">
             <div className="flex-1 min-w-0">
                <Dashboard data={telemetry} />
             </div>
             
             <div className="w-56 bg-[#0a0a0a] border border-white/10 rounded-lg p-3 flex flex-col shrink-0 relative overflow-hidden">
                <h4 className="mono-label mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest absolute top-3 left-3 z-10 w-full bg-[#0a0a0a]">Circuit Map</h4>
                <div className="flex-1 -mt-2">
                  <TrackMap track={simState.track} active={simState.isActive} speed={latest?.speed || 0} />
                </div>
             </div>

             <div className="w-56 bg-[#0a0a0a] border border-white/10 rounded-lg p-3 flex flex-col shrink-0">
                <h4 className="mono-label mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Weather Status</h4>
                <div className="grid grid-cols-2 gap-2 flex-1">
                  <WeatherMiniCard label="TEMP" value={trackWeather.temp} />
                  <WeatherMiniCard label="HUMIDITY" value={trackWeather.humidity} />
                  <WeatherMiniCard label="WIND SPD" value={trackWeather.windSpeed} />
                  <WeatherMiniCard label="HEADING" value={trackWeather.heading} accent />
                </div>
              </div>
          </div>
        </main>

        {/* RIGHT ANALYTICS SIDEBAR */}
        <aside className="w-64 border-l border-white/10 bg-[#080808] p-4 flex flex-col gap-6 shrink-0 text-slate-400 overflow-y-auto">
          <div>
            <h3 className="mono-label mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
              <span>Vehicle Mode</span>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="text-[8px] flex items-center gap-1 bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded text-indigo-300 transition-colors"
                title="Save current setup as default for this car"
              >
                <Save className="w-3 h-3" />
                SAVE CONFIG
              </button>
            </h3>
            <div className="flex bg-[#050505] border border-white/10 rounded overflow-hidden">
              {(['Formula 1', 'Hypercar', 'GT3'] as const).map(model => (
                <button
                  key={model}
                  type="button"
                  onClick={() => handleCarModelChange(model)}
                  className={cn(
                    "flex-1 text-[9px] font-bold uppercase tracking-tighter py-1.5 transition-colors",
                    simState.carModel === model
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-500 hover:bg-white/5'
                  )}
                >
                  {model === 'Formula 1' ? 'F1' : model === 'Hypercar' ? 'LMP' : 'GT3'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mono-label mb-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aero Analysis</h3>
            <div className="space-y-4">
              <AnalysisMetric label="Drag (Cd)" value="0.842" percent={65} color="bg-indigo-400" />
              <AnalysisMetric label="Lift (Cl)" value="-3.120" percent={82} color="bg-indigo-400" />
              <AnalysisMetric label="Efficiency (L/D)" value="3.705" percent={74} color="bg-emerald-400" />
            </div>
          </div>

          <div>
             <h3 className="mono-label mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aero Configuration</h3>
             <div className="space-y-4">
                <SliderControl label="F-WING" value={setup.frontWingAngle} unit="°" min={0} max={30} onChange={v => setSetup(s => ({ ...s, frontWingAngle: v }))} dense />
                <SliderControl label="R-WING" value={setup.rearWingAngle} unit="°" min={0} max={45} onChange={v => setSetup(s => ({ ...s, rearWingAngle: v }))} dense />
                <SliderControl label="RIDE-H" value={setup.rideHeight} unit="mm" min={20} max={80} onChange={v => setSetup(s => ({ ...s, rideHeight: v }))} dense />
             </div>
          </div>

          <div>
             <h3 className="mono-label mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mechanical Config</h3>
             <div className="space-y-4">
                <SliderControl label="BRAKE-BAL" value={setup.brakeBalance} unit="%" min={40} max={70} onChange={v => setSetup(s => ({ ...s, brakeBalance: v }))} dense />
                <SliderControl label="TIRE-PRES" value={setup.tirePressure} unit="psi" min={18} max={25} onChange={v => setSetup(s => ({ ...s, tirePressure: v }))} dense />
                
                <div className="flex flex-col gap-1 mt-2">
                  <span className="text-[10px] text-slate-500 uppercase font-mono tracking-widest leading-none">Compound</span>
                  {!simState.isActive ? (
                    <div className="flex bg-[#050505] border border-white/10 rounded overflow-hidden">
                      {(['Soft', 'Medium', 'Hard', 'Intermediate', 'Wet'] as const).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSetup(s => ({ ...s, tireType: type }))}
                          className={cn(
                            "flex-1 text-[9px] font-bold uppercase tracking-tighter py-1.5 transition-colors",
                            setup.tireType === type 
                              ? type === 'Soft' ? 'bg-red-500 text-white' 
                                : type === 'Medium' ? 'bg-yellow-500 text-black'
                                : type === 'Hard' ? 'bg-white text-black'
                                : type === 'Intermediate' ? 'bg-emerald-500 text-white'
                                : 'bg-blue-500 text-white'
                              : 'text-slate-500 hover:bg-white/5'
                          )}
                        >
                          {type[0]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex bg-[#050505] border border-white/10 rounded px-3 py-2 items-center justify-between">
                         <span className="text-[10px] font-bold text-slate-400 uppercase">Current</span>
                         <span className={cn(
                           "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                           setup.tireType === 'Soft' ? 'bg-red-500 text-white' 
                           : setup.tireType === 'Medium' ? 'bg-yellow-500 text-black'
                           : setup.tireType === 'Hard' ? 'bg-white text-black'
                           : setup.tireType === 'Intermediate' ? 'bg-emerald-500 text-white'
                           : 'bg-blue-500 text-white'
                         )}>{setup.tireType}</span>
                      </div>
                      
                      {pitState.status === 'none' && !showPitMenu && (
                        <button
                          type="button"
                          onClick={() => {
                             setPitConfig({ tire: setup.tireType, repairs: false });
                             setShowPitMenu(true);
                          }}
                          className="w-full bg-slate-800 text-white rounded font-mono text-[10px] uppercase font-bold py-2 hover:bg-slate-700 transition flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-600"
                        >
                          <Wrench className="w-3 h-3" />
                          BOX BOX
                        </button>
                      )}
                      
                      {showPitMenu && (
                        <div className="flex flex-col gap-2 bg-[#0a0a0a] border border-indigo-500/30 rounded p-2 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                          <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest text-center">Pit Strategy</span>
                          
                          <div className="flex bg-[#050505] border border-white/10 rounded overflow-hidden">
                            {(['Soft', 'Medium', 'Hard', 'Intermediate', 'Wet'] as const).map(type => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setPitConfig(s => ({ ...s, tire: type }))}
                                className={cn(
                                  "flex-1 text-[9px] font-bold uppercase tracking-tighter py-1 transition-colors",
                                  pitConfig.tire === type 
                                    ? type === 'Soft' ? 'bg-red-500 text-white' 
                                      : type === 'Medium' ? 'bg-yellow-500 text-black'
                                      : type === 'Hard' ? 'bg-white text-black'
                                      : type === 'Intermediate' ? 'bg-emerald-500 text-white'
                                      : 'bg-blue-500 text-white'
                                    : 'text-slate-500 hover:bg-white/5'
                                )}
                              >
                                {type[0]}
                              </button>
                            ))}
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => setPitConfig(s => ({ ...s, repairs: !s.repairs }))}
                            className={cn(
                              "text-[10px] py-1 border rounded transition-colors uppercase font-bold",
                              pitConfig.repairs ? "bg-rose-500/20 text-rose-400 border-rose-500/50" : "bg-[#050505] text-slate-400 border-white/10 hover:bg-white/5"
                            )}
                          >
                            Aerodynamic Repairs {pitConfig.repairs ? '(+1.5s)' : ''}
                          </button>
                          
                          <div className="flex gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => setShowPitMenu(false)}
                              className="flex-1 bg-[#050505] border border-white/10 text-slate-400 text-[9px] font-bold py-1.5 rounded hover:bg-white/5 uppercase"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowPitMenu(false);
                                triggerPitStop(pitConfig.tire, pitConfig.repairs);
                              }}
                              className="flex-1 bg-indigo-600 border border-indigo-500 text-white text-[9px] font-bold py-1.5 rounded hover:bg-indigo-500 uppercase"
                            >
                              Confirm
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {pitState.status !== 'none' && pitState.status !== 'completed' && (
                        <div className="flex flex-col gap-2 bg-indigo-900/20 border border-indigo-500/30 rounded p-3 text-center items-center justify-center">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest animate-pulse">
                            {pitState.status === 'requested' ? 'Pit Window Open (In-Lap)' : 'In Pit Space'}
                          </span>
                          
                          {pitState.status === 'pitting' && pitState.timer !== undefined && (
                            <div className="flex items-center gap-2 text-white font-mono text-xl mt-1">
                              <Timer className="w-5 h-5 text-indigo-400" />
                              {(pitState.timer / 1000).toFixed(2)}s
                            </div>
                          )}
                          
                          <span className="text-[9px] font-mono text-slate-500 mt-1 uppercase">
                            Next: {pitState.scheduledTire} {pitState.repairs ? '+ Rep' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
             </div>
          </div>

          <div className="mt-auto flex-1 flex flex-col min-h-0 pt-2">
             <h3 className="mono-label mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between shrink-0">
               <span>Live Standings</span>
               <span className="text-emerald-500">Lap {standings[0]?.lap || 1}</span>
             </h3>
             <Standings standings={standings} />
          </div>
        </aside>
      </div>

      {/* FOOTER CONTROLS */}
      <footer className="h-12 border-t border-white/10 bg-[#0a0a0a] flex items-center px-4 gap-6 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Wind Speed</span>
          <input type="range" className="w-32 h-1 bg-slate-800 accent-indigo-500" />
          <span className="text-[10px] font-mono">75 m/s</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Solver Load</span>
          <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
             <div className="h-full bg-indigo-500/50" style={{ width: '42%' }} />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <button 
             onClick={() => setSimState(s => ({ ...s, isActive: !s.isActive }))}
             className="px-6 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            {simState.isActive ? 'Stop Simulation' : 'Run Simulation'}
          </button>
          <button className="px-4 py-1.5 bg-transparent border border-white/20 hover:bg-white/5 text-white text-[10px] font-bold uppercase tracking-widest transition-colors">
            Export Log
          </button>
          <button 
             onClick={requestAiAdvice}
             className="w-8 h-8 flex items-center justify-center rounded bg-white/5 border border-white/10 text-white hover:bg-white/10"
          >
            {isAiLoading ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
          </button>
        </div>
      </footer>
    </div>
  );
}

const HeaderMetric = ({ label, value }: { label: string, value: string | undefined }) => (
  <div className="flex flex-col">
    <span className="text-[10px] text-slate-500 uppercase font-mono">{label}</span>
    <span className="text-xs font-bold text-white tracking-widest">{value}</span>
  </div>
);

const TelemetryRow = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className="flex justify-between items-center bg-white/5 p-2 rounded">
    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">{label}</span>
    <span className={cn("text-xs font-mono font-bold tracking-widest", color)}>{value}</span>
  </div>
);

const HealthStatus = ({ label, status }: { label: string, status: 'ok' | 'warn' }) => (
  <div className="flex items-center gap-2 text-[10px]">
    <div className={cn("w-1.5 h-1.5 rounded-full", status === 'ok' ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" : "bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]")}></div>
    <span className="tracking-tight uppercase font-mono">{label}</span>
  </div>
);

const WeatherMiniCard = ({ label, value, accent }: { label: string, value: string, accent?: boolean }) => (
  <div className="bg-white/5 py-1 px-2 rounded">
    <span className="text-[8px] block text-slate-500 uppercase tracking-tighter">{label}</span>
    <span className={cn("text-xs font-mono font-bold", accent ? "text-emerald-400" : "text-white")}>{value}</span>
  </div>
);

const AnalysisMetric = ({ label, value, percent, color }: { label: string, value: string, percent: number, color: string }) => (
  <div className="flex flex-col">
    <div className="flex justify-between mb-1">
      <span className="text-[10px] text-slate-500 font-mono uppercase tracking-tighter">{label}</span>
      <span className="text-xs font-mono font-bold text-white">{value}</span>
    </div>
    <div className="w-full h-1 bg-slate-800 rounded-full">
      <div className={cn("h-full transition-all duration-500", color)} style={{ width: `${percent}%` }}></div>
    </div>
  </div>
);

const SliderControl = ({ label, value, unit, min, max, onChange, dense }: { label: string, value: number, unit: string, min: number, max: number, onChange: (v: number) => void, dense?: boolean }) => (
  <div>
    <div className="flex justify-between text-[10px] mb-1">
      <span className="text-slate-500 uppercase font-mono tracking-widest">{label}</span>
      <span className="font-bold text-white tracking-widest">{value}{unit}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max} 
      value={value} 
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-indigo-500 bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer"
    />
  </div>
);

