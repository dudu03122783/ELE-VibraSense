
import { ProcessedDataPoint, RawDataPoint, FFTResult, AnalysisStats, DataAxis, Point, ElevatorBoundaries, IsoStats } from '../types';

// Simple CSV Parser
export const parseCSV = (csvText: string, fs: number = 1600): RawDataPoint[] => {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  const axIdx = headers.indexOf('ax');
  const ayIdx = headers.indexOf('ay');
  const azIdx = headers.indexOf('az');

  if (axIdx === -1 || ayIdx === -1 || azIdx === -1) {
    throw new Error("CSV must contain 'ax', 'ay', and 'az' columns");
  }

  const data: RawDataPoint[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',').map(Number);
    // Basic validation to ensure we have numbers
    if (isNaN(values[axIdx]) || isNaN(values[ayIdx]) || isNaN(values[azIdx])) continue;

    data.push({
      time: (i - 1) / fs,
      ax: values[axIdx],
      ay: values[ayIdx],
      az: values[azIdx]
    });
  }
  return data;
};

// Numerical Integration (Trapezoidal Rule)
export const processVibrationData = (rawData: RawDataPoint[], fs: number): ProcessedDataPoint[] => {
  const n = rawData.length;
  if (n === 0) return [];

  // 1. Calculate Means (Remove DC Offset)
  let sumAx = 0, sumAy = 0, sumAz = 0;
  for (let i = 0; i < n; i++) {
    sumAx += rawData[i].ax;
    sumAy += rawData[i].ay;
    sumAz += rawData[i].az;
  }
  const axMean = sumAx / n;
  const ayMean = sumAy / n;
  const azMean = sumAz / n;

  const processed = new Array<ProcessedDataPoint>(n);
  const dt = 1 / fs;

  // 2. Prepare Detrended Z-Acceleration in m/s^2
  // 1 Gal = 0.01 m/s^2 (divide by 100)
  const azMps2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    azMps2[i] = (rawData[i].az - azMean) / 100;
  }

  // 3. Calculate Velocity (VZ)
  const vz = new Float64Array(n);
  vz[0] = 0;
  for (let i = 1; i < n; i++) {
    vz[i] = vz[i-1] + (azMps2[i-1] + azMps2[i]) * 0.5 * dt;
  }

  // 4. Calculate Displacement (SZ)
  const sz = new Float64Array(n);
  sz[0] = 0;
  for (let i = 1; i < n; i++) {
    sz[i] = sz[i-1] + (vz[i-1] + vz[i]) * 0.5 * dt;
  }

  // 5. Assemble Result
  for (let i = 0; i < n; i++) {
    processed[i] = {
      time: rawData[i].time,
      ax: rawData[i].ax - axMean,
      ay: rawData[i].ay - ayMean,
      az: rawData[i].az - azMean,
      vz: vz[i],
      sz: sz[i]
    };
  }

  return processed;
};

// Simple bit reversal for FFT
const reverseBits = (x: number, bits: number): number => {
  let y = 0;
  for (let i = 0; i < bits; i++) {
    y = (y << 1) | (x & 1);
    x >>= 1;
  }
  return y;
};

// Cooley-Tukey FFT Implementation
export const calculateFFT = (data: number[], fs: number): FFTResult[] => {
  const n = data.length;
  if (n === 0) return [];
  
  const p = Math.floor(Math.log2(n));
  const N = 1 << p; 
  
  const real = new Float64Array(N);
  const imag = new Float64Array(N);
  
  for (let i = 0; i < N; i++) {
    real[i] = data[i];
    imag[i] = 0;
  }

  const bits = Math.log2(N);
  for (let i = 0; i < N; i++) {
    const rev = reverseBits(i, bits);
    if (rev > i) {
      [real[i], real[rev]] = [real[rev], real[i]];
      [imag[i], imag[rev]] = [imag[rev], imag[i]];
    }
  }

  for (let s = 1; s <= bits; s++) {
    const m = 1 << s; 
    const m2 = m >> 1;
    const wmReal = Math.cos(Math.PI / m2);
    const wmImag = -Math.sin(Math.PI / m2); 

    for (let k = 0; k < N; k += m) {
      let wReal = 1;
      let wImag = 0;
      for (let j = 0; j < m2; j++) {
        const tReal = wReal * real[k + j + m2] - wImag * imag[k + j + m2];
        const tImag = wReal * imag[k + j + m2] + wImag * real[k + j + m2];
        
        const uReal = real[k + j];
        const uImag = imag[k + j];

        real[k + j] = uReal + tReal;
        imag[k + j] = uImag + tImag;
        real[k + j + m2] = uReal - tReal;
        imag[k + j + m2] = uImag - tImag;

        const wRealTemp = wReal * wmReal - wImag * wmImag;
        wImag = wReal * wmImag + wImag * wmReal;
        wReal = wRealTemp;
      }
    }
  }

  const results: FFTResult[] = [];
  for (let i = 0; i < N / 2; i++) {
    const freq = i * fs / N;
    if (freq >= 0.5 && freq <= 200) { // Ignore DC and very high freq
      let magnitude = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / N;
      if (i > 0) magnitude *= 2; 
      results.push({ frequency: freq, magnitude });
    }
  }

  return results;
};

export const calculateStats = (data: ProcessedDataPoint[], axis: DataAxis, startTime?: number, endTime?: number): AnalysisStats => {
  // Filter by time if provided
  let slice = data;
  if (startTime !== undefined && endTime !== undefined) {
    slice = data.filter(d => d.time >= startTime && d.time <= endTime);
  }

  if (slice.length === 0) {
    return { peakVal: 0, peakTime: 0, rms: 0, pkPk: 0, zeroPk: 0, a95: 0 };
  }

  // 1. Extract Series & RMS
  const values = new Float64Array(slice.length);
  let sumSq = 0;
  let overallMaxAbs = 0;
  let overallMaxPoint: Point = { time: 0, value: 0 };

  for (let i = 0; i < slice.length; i++) {
    const val = slice[i][axis];
    values[i] = val;
    sumSq += val * val;
    
    if (Math.abs(val) > overallMaxAbs) {
      overallMaxAbs = Math.abs(val);
      overallMaxPoint = { time: slice[i].time, value: val };
    }
  }

  const rms = Math.sqrt(sumSq / slice.length);

  // If not an acceleration axis, simple Max-Min is sufficient
  if (axis === 'vz' || axis === 'sz') {
     let min = Infinity, max = -Infinity;
     for(let v of values) {
       if(v < min) min = v;
       if(v > max) max = v;
     }
     return {
       peakVal: overallMaxAbs,
       peakTime: overallMaxPoint.time,
       rms,
       pkPk: max - min,
       zeroPk: overallMaxAbs,
       a95: overallMaxAbs, 
       max0PkPoint: overallMaxPoint
     };
  }

  // 2. Find Zero Crossings and Peaks (Appendix A Method)
  interface LocalPeak {
    value: number; 
    abs: number;
    time: number;
    idx: number;
  }

  const peaks: LocalPeak[] = [];
  let lastZC = 0;
  
  const findLocalPeak = (startIdx: number, endIdx: number): LocalPeak | null => {
    if (startIdx >= endIdx) return null;
    let maxAbs = -1;
    let bestIdx = -1;
    for (let i = startIdx; i < endIdx; i++) {
      const abs = Math.abs(values[i]);
      if (abs > maxAbs) {
        maxAbs = abs;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) return null;
    return {
      value: values[bestIdx],
      abs: maxAbs,
      time: slice[bestIdx].time,
      idx: bestIdx
    };
  };

  for (let i = 0; i < slice.length - 1; i++) {
    const v1 = values[i];
    const v2 = values[i+1];
    
    if ((v1 >= 0 && v2 < 0) || (v1 < 0 && v2 >= 0)) {
      const peak = findLocalPeak(lastZC, i + 1);
      if (peak) {
        peaks.push(peak);
      }
      lastZC = i + 1;
    }
  }
  const lastPeak = findLocalPeak(lastZC, slice.length);
  if (lastPeak) peaks.push(lastPeak);

  // 3. Calculate Pk-Pk Values (Adjacent peaks)
  const pkPkValues: number[] = [];
  const pkPkPairs: { val: number, p1: LocalPeak, p2: LocalPeak }[] = [];

  for (let i = 0; i < peaks.length - 1; i++) {
    const p1 = peaks[i];
    const p2 = peaks[i+1];
    
    if ((p1.value > 0 && p2.value < 0) || (p1.value < 0 && p2.value > 0)) {
      const ppVal = p1.abs + p2.abs;
      pkPkValues.push(ppVal);
      pkPkPairs.push({ val: ppVal, p1, p2 });
    }
  }

  if (pkPkValues.length === 0) {
    return { peakVal: overallMaxAbs, peakTime: overallMaxPoint.time, rms, pkPk: 0, zeroPk: overallMaxAbs, a95: 0 };
  }

  // 4. Max Pk-Pk
  let maxPkPk = 0;
  let maxPkPkPair: [Point, Point] | undefined = undefined;
  
  for (const item of pkPkPairs) {
    if (item.val > maxPkPk) {
      maxPkPk = item.val;
      maxPkPkPair = item.p1.time < item.p2.time 
        ? [{time: item.p1.time, value: item.p1.value}, {time: item.p2.time, value: item.p2.value}]
        : [{time: item.p2.time, value: item.p2.value}, {time: item.p1.time, value: item.p1.value}];
    }
  }

  // 5. A95 Pk-Pk
  pkPkValues.sort((a, b) => a - b);
  const index95 = Math.floor(pkPkValues.length * 0.95);
  const a95 = pkPkValues[Math.min(index95, pkPkValues.length - 1)];

  return {
    peakVal: overallMaxAbs,
    peakTime: overallMaxPoint.time,
    rms,
    pkPk: maxPkPk,
    zeroPk: overallMaxAbs,
    a95: a95,
    max0PkPoint: overallMaxPoint,
    maxPkPkPair
  };
};

export const downsampleData = (data: ProcessedDataPoint[], targetCount: number = 5000): ProcessedDataPoint[] => {
  const len = data.length;
  if (len <= targetCount) return data;
  
  const buckets = Math.floor(targetCount / 2);
  const step = Math.floor(len / buckets);
  const result: ProcessedDataPoint[] = [];
  
  for (let i = 0; i < len; i += step) {
    const end = Math.min(i + step, len);
    let maxAbs = -1;
    let maxIdx = i;
    
    for(let j=i; j<end; j++) {
      const val = Math.max(Math.abs(data[j].ax), Math.abs(data[j].ay), Math.abs(data[j].az));
      if (val > maxAbs) {
        maxAbs = val;
        maxIdx = j;
      }
    }
    result.push(data[i]);
    if (maxIdx !== i) result.push(data[maxIdx]);
  }
  return result;
};

// --- ISO 18738 / GB/T 24474 Specific Calculations ---

export const calculateLiftBoundaries = (data: ProcessedDataPoint[]): ElevatorBoundaries => {
  const n = data.length;
  if (n === 0) return { t0: 0, t1: 0, t2: 0, t3: 0, isValid: false };

  // Find max velocity (assuming simple run)
  let vMax = 0;
  for(let i=0; i<n; i++) {
    if (Math.abs(data[i].vz) > vMax) vMax = Math.abs(data[i].vz);
  }

  // Thresholds
  const motionThreshold = vMax * 0.05; // 5% of Vmax counts as motion
  const constVelThreshold = vMax * 0.95; // 95% of Vmax counts as constant velocity

  let t0 = 0, t1 = 0, t2 = 0, t3 = data[n-1].time;
  
  // Find t0 (Start of motion)
  for(let i=0; i<n; i++) {
    if (Math.abs(data[i].vz) > motionThreshold) {
      t0 = data[i].time;
      break;
    }
  }

  // Find t3 (End of motion) - search backwards
  for(let i=n-1; i>=0; i--) {
    if (Math.abs(data[i].vz) > motionThreshold) {
      t3 = data[i].time;
      break;
    }
  }

  // Find t1 (Start of Const Vel)
  for(let i=0; i<n; i++) {
    if (data[i].time > t0 && Math.abs(data[i].vz) > constVelThreshold) {
      t1 = data[i].time;
      break;
    }
  }

  // Find t2 (End of Const Vel)
  for(let i=n-1; i>=0; i--) {
    if (data[i].time < t3 && Math.abs(data[i].vz) > constVelThreshold) {
      t2 = data[i].time;
      break;
    }
  }

  // Fallback if no valid plateau found
  if (t1 === 0 || t2 === 0 || t2 <= t1) {
    t1 = t0 + (t3-t0)*0.4;
    t2 = t0 + (t3-t0)*0.6;
    return { t0, t1, t2, t3, isValid: false }; // Not a standard curve
  }

  return { t0, t1, t2, t3, isValid: true };
};

export const calculateIsoStats = (data: ProcessedDataPoint[], bounds: ElevatorBoundaries): IsoStats => {
  const { t0, t1, t2, t3 } = bounds;

  // X Axis: Const Vel region only (t1-t2)
  const xStats = calculateStats(data, 'ax', t1, t2);

  // Y Axis: Const Vel region only (t1-t2)
  const yStats = calculateStats(data, 'ay', t1, t2);

  // Z Axis:
  // 1. Const Vel (t1-t2): Max & A95
  const zConst = calculateStats(data, 'az', t1, t2);
  
  // 2. Global (t0-t3): Max (covers Accel/Decel/Const)
  const zGlobal = calculateStats(data, 'az', t0, t3);

  return {
    x: { constVel: xStats },
    y: { constVel: yStats },
    z: { constVel: zConst, global: zGlobal }
  };
};
