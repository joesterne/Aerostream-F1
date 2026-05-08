export interface TelemetryData {
  speed: number;
  downforce: number;
  drag: number;
  cd: number; // Drag Coefficient
  cl: number; // Lift/Downforce Coefficient
  balance: number; // Aero Balance (Front %)
  instability?: number; // Aero stability index (0=perfect, 1=unstable)
  tireTemp: {
    fl: number;
    fr: number;
    rl: number;
    rr: number;
  };
  tireWear: {
    fl: number;
    fr: number;
    rl: number;
    rr: number;
  };
  ers: number;
  timestamp: number;
  lapTime?: number;
}

export type TireType = 'Soft' | 'Medium' | 'Hard' | 'Intermediate' | 'Wet';

export interface AeroSetup {
  frontWingAngle: number;
  rearWingAngle: number;
  rideHeight: number;
  brakeBalance: number;
  tirePressure: number;
  tireWear: number;
  tireType: TireType;
}

export interface SimulationState {
  isActive: boolean;
  isMultiplayer: boolean;
  weather: 'Sunny' | 'Rain' | 'Cloudy' | 'Overcast';
  track: string;
  ersMode?: 'neutral' | 'regen' | 'boost';
  carModel?: 'Formula 1' | 'Hypercar' | 'GT3';
}

export interface DriverStanding {
  id: string;
  position: number;
  name: string;
  number: number;
  team: string;
  gap: string;
  interval: string;
  lap: number;
  status: 'active' | 'pit' | 'out';
  isPlayer?: boolean;
  penalties?: { type: 'time' | 'drive-through' | 'stop-go', amount?: number, reason: string, served?: boolean }[];
}

export interface TuningAdvice {
  analysis: string;
  suggestions: {
    frontWingAngle?: number;
    rearWingAngle?: number;
    rideHeight?: number;
    brakeBalance?: number;
  };
  reasoning: string;
}
