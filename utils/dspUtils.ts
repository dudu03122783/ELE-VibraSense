
import { RawDataPoint, FilterConfig } from '../types';

// 2nd Order Butterworth Filter Coefficient Calculation
const calculateCoefficients = (
  type: 'lowpass' | 'highpass',
  cutoff: number,
  fs: number
) => {
  const wc = (2 * Math.PI * cutoff) / fs;
  
  let a0, a1, a2, b0, b1, b2;

  if (type === 'lowpass') {
    const omega = 2 * Math.PI * cutoff / fs;
    const sn = Math.sin(omega);
    const cs = Math.cos(omega);
    const alpha = sn / (2 * 0.707); // Q = 0.707 for Butterworth
    
    const A0 = 1 + alpha;
    b0 = (1 - cs) / 2 / A0;
    b1 = (1 - cs) / A0;
    b2 = (1 - cs) / 2 / A0;
    a1 = (-2 * cs) / A0;
    a2 = (1 - alpha) / A0;

  } else {
    // Highpass
    const omega = 2 * Math.PI * cutoff / fs;
    const sn = Math.sin(omega);
    const cs = Math.cos(omega);
    const alpha = sn / (2 * 0.707);
    
    const A0 = 1 + alpha;
    b0 = (1 + cs) / 2 / A0;
    b1 = -(1 + cs) / A0;
    b2 = (1 + cs) / 2 / A0;
    a1 = (-2 * cs) / A0;
    a2 = (1 - alpha) / A0;
  }

  return { b: [b0, b1, b2], a: [1, a1, a2] };
};

const filterSeries = (data: number[], b: number[], a: number[]): number[] => {
  const output = new Float64Array(data.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  
  for (let i = 0; i < data.length; i++) {
    const x0 = data[i];
    const y0 = b[0] * x0 + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    
    output[i] = y0;
    
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  
  // Zero-phase (filtfilt) by filtering backwards
  const outputRev = new Float64Array(data.length);
  x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    const x0 = output[i];
    const y0 = b[0] * x0 + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    outputRev[i] = y0;
    
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  
  const res = new Array(data.length);
  for(let i=0; i<data.length; i++) res[i] = outputRev[i];
  return res;
};

export const applyFilters = (
  data: RawDataPoint[], 
  fs: number, 
  config: FilterConfig
): RawDataPoint[] => {
  if (data.length === 0) return [];

  const ax = data.map(d => d.ax);
  const ay = data.map(d => d.ay);
  const az = data.map(d => d.az);

  let filteredAx = ax;
  let filteredAy = ay;
  let filteredAz = az;

  // 1. Determine which axes to filter
  const filterZ = true; // Always filter Z if enabled
  const filterXY = config.targetAxes === 'all';

  // 2. Apply High Pass (if > 0)
  if (config.highPassFreq > 0) {
    const coeffs = calculateCoefficients('highpass', config.highPassFreq, fs);
    if (filterXY) filteredAx = filterSeries(filteredAx, coeffs.b, coeffs.a);
    if (filterXY) filteredAy = filterSeries(filteredAy, coeffs.b, coeffs.a);
    if (filterZ)  filteredAz = filterSeries(filteredAz, coeffs.b, coeffs.a);
  }

  // 3. Apply Low Pass (if < fs/2)
  if (config.lowPassFreq < fs / 2 && config.lowPassFreq > 0) {
    const coeffs = calculateCoefficients('lowpass', config.lowPassFreq, fs);
    if (filterXY) filteredAx = filterSeries(filteredAx, coeffs.b, coeffs.a);
    if (filterXY) filteredAy = filterSeries(filteredAy, coeffs.b, coeffs.a);
    if (filterZ)  filteredAz = filterSeries(filteredAz, coeffs.b, coeffs.a);
  }

  // Reassemble
  const result = new Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = {
      time: data[i].time,
      ax: filteredAx[i],
      ay: filteredAy[i],
      az: filteredAz[i]
    };
  }
  return result;
};
