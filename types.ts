
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
  brushColor: string; // Added for visibility
  chartColors: {
    ax: string;
    ay: string;
    az: string;
    vz: string;
    sz: string;
  };
}
