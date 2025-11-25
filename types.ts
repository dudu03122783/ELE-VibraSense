
export interface RawDataPoint {
  time: number;
  ax: number; // Gals
  ay: number; // Gals
  az: number; // Gals
}

export interface ProcessedDataPoint extends RawDataPoint {
  vz: number; // m/s
  sz: number; // m
}

export interface FFTResult {
  frequency: number;
  magnitude: number;
}

export type DataAxis = 'ax' | 'ay' | 'az' | 'vz' | 'sz';

export interface Point {
  time: number;
  value: number;
}

export interface AnalysisStats {
  peakVal: number; // Represents 0-Pk (Max Abs)
  peakTime: number;
  rms: number;
  
  // GB/T 24474 / ISO 18738 Specifics
  pkPk: number;    // Max Peak-to-Peak (P_max)
  zeroPk: number;  // Max 0-Peak
  a95: number;     // A95 Peak-to-Peak
  
  // For Visualization
  max0PkPoint?: Point;      // The single point for Max 0-Pk
  maxPkPkPair?: [Point, Point]; // The two adjacent peaks forming the Max Pk-Pk
}

export interface ElevatorBoundaries {
  t0: number; // Motion start
  t1: number; // Const vel start
  t2: number; // Const vel end
  t3: number; // Motion end
  isValid: boolean;
}

export interface IsoAxisStats {
  constVel: AnalysisStats; // Stats during t1-t2
  global?: AnalysisStats;  // Stats during t0-t3 (for Z axis)
}

export interface IsoStats {
  x: IsoAxisStats;
  y: IsoAxisStats;
  z: IsoAxisStats;
}

export interface AIAnalysisResult {
  status: 'safe' | 'warning' | 'danger' | 'unknown';
  summary: string;
  recommendations: string[];
}

export interface ThemeConfig {
  id: string;
  name: string;
  bgApp: string;
  bgCard: string;
  bgPanel: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  accent: string;
  gridColor: string;
  brushColor: string;
  textColorHex: string; // Explicit Hex for SVG/Charts
  chartColors: {
    ax: string;
    ay: string;
    az: string;
    vz: string;
    sz: string;
  };
}

export interface FilterConfig {
  enabled: boolean;
  highPassFreq: number; // Hz
  lowPassFreq: number; // Hz
  isStandardWeighting: boolean; // Just a UI flag
  targetAxes: 'all' | 'z-only'; // Selective filtering
}
