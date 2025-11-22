import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ReferenceArea, ReferenceLine, Brush, Label, ReferenceDot
} from 'recharts';
import { FFTResult, ProcessedDataPoint, DataAxis, AnalysisStats } from '../types';

const THEME_COLORS = {
  ax: '#ef4444', // Red
  ay: '#22c55e', // Green
  az: '#3b82f6', // Blue
  vz: '#a855f7', // Purple
  sz: '#f97316', // Orange
};

interface TimeChartProps {
  data: ProcessedDataPoint[];
  axis: DataAxis;
  color: string;
  syncId?: string;
  windowRange?: { start: number; end: number };
  referenceLines?: number[]; // Values like [10, -10]
  onChartClick?: (time: number) => void;
  globalStats?: AnalysisStats | null;
}

const formatScientificIfNeeded = (val: number) => {
  if (val === 0) return "0";
  if (Math.abs(val) < 0.001) {
    return val.toExponential(2);
  }
  return val.toFixed(3);
};

export const TimeChart: React.FC<TimeChartProps> = ({ 
  data, 
  axis, 
  color, 
  syncId,
  windowRange,
  referenceLines,
  onChartClick,
  globalStats
}) => {
  const unit = axis.startsWith('a') ? 'Gals' : axis === 'vz' ? 'm/s' : 'm';

  return (
    <div className="h-full w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={data} 
          syncId={syncId}
          onClick={(e) => {
            if (onChartClick && e && e.activeLabel) {
              onChartClick(Number(e.activeLabel));
            }
          }}
          margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis 
            dataKey="time" 
            type="number" 
            domain={['dataMin', 'dataMax']} 
            hide={false} 
            stroke="#6b7280"
            fontSize={10}
            tickFormatter={(val) => val.toFixed(1) + 's'}
            minTickGap={50}
          />
          <YAxis 
            stroke="#9ca3af" 
            fontSize={11} 
            tickFormatter={formatScientificIfNeeded}
            domain={['auto', 'auto']}
            width={60}
          >
             <Label 
               value={unit} 
               angle={-90} 
               position="insideLeft" 
               style={{ textAnchor: 'middle', fill: '#6b7280', fontSize: 10 }} 
             />
          </YAxis>
          <Tooltip 
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#fff' }}
            labelStyle={{ color: '#9ca3af' }}
            itemStyle={{ color: color }}
            formatter={(value: number) => [formatScientificIfNeeded(value), axis.toUpperCase()]}
            labelFormatter={(label) => `Time: ${Number(label).toFixed(3)}s`}
          />
          <Line 
            type="monotone" 
            dataKey={axis} 
            stroke={color} 
            strokeWidth={1.5} 
            dot={false} 
            isAnimationActive={false} // Performance
          />
          {windowRange && (
            <ReferenceArea 
              x1={windowRange.start} 
              x2={windowRange.end} 
              fill="#14b8a6" // Teal-500
              fillOpacity={0.15}
              stroke="#14b8a6"
              strokeOpacity={0.5}
            />
          )}
          {referenceLines && referenceLines.map((val, idx) => (
             <ReferenceLine key={idx} y={val} stroke="#ef4444" strokeDasharray="3 3" opacity={0.7}>
               <Label value={val.toString()} position="right" fill="#ef4444" fontSize={10} />
             </ReferenceLine>
          ))}
          
          {/* Marker for Max 0-Pk (Absolute Max) */}
          {globalStats?.max0PkPoint && (
            <ReferenceDot 
              x={globalStats.max0PkPoint.time} 
              y={globalStats.max0PkPoint.value} 
              r={5} 
              fill="transparent"
              stroke="#fff" 
              strokeWidth={2}
              strokeDasharray="3 3"
            >
              {/* Just a dot for 0-pk, label is in sidebar to avoid clutter */}
            </ReferenceDot>
          )}

          {/* Markers for Max Pk-Pk Pair (The two peaks forming the max Pk-Pk) */}
          {globalStats?.maxPkPkPair && (
            <>
              <ReferenceDot 
                x={globalStats.maxPkPkPair[0].time} 
                y={globalStats.maxPkPkPair[0].value} 
                r={4} 
                fill="#fbbf24" // Amber
                stroke="none"
              />
              <ReferenceDot 
                x={globalStats.maxPkPkPair[1].time} 
                y={globalStats.maxPkPkPair[1].value} 
                r={4} 
                fill="#fbbf24" // Amber
                stroke="none"
              />
              {/* Connecting Line Visual (Simulated by dots or rely on eye) 
                  Note: Recharts doesn't support arbitrary lines easily without data, 
                  so we just mark the two peaks.
              */}
            </>
          )}

          {/* Brush for Zooming and Panning */}
          <Brush 
            dataKey="time" 
            height={30} 
            stroke="#4b5563"
            fill="#1f2937"
            tickFormatter={(val) => typeof val === 'number' ? val.toFixed(1) : val}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

interface FFTChartProps {
  data: FFTResult[];
  color: string;
}

export const FFTChart: React.FC<FFTChartProps> = ({ data, color }) => {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="colorSplit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis 
            dataKey="frequency" 
            type="number" 
            stroke="#9ca3af" 
            fontSize={11}
            tickCount={10}
            label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -5, fill: '#6b7280' }}
          />
          <YAxis 
            stroke="#9ca3af" 
            fontSize={11}
            tickFormatter={formatScientificIfNeeded}
            width={50}
          />
          <Tooltip 
            cursor={{stroke: '#fff', strokeWidth: 1, strokeDasharray: '3 3'}}
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#fff' }}
            formatter={(value: number) => [value.toFixed(4), 'Magnitude']}
            labelFormatter={(label) => `Freq: ${Number(label).toFixed(2)}Hz`}
          />
          <Area 
            type="monotone" 
            dataKey="magnitude" 
            stroke={color} 
            fillOpacity={1} 
            fill="url(#colorSplit)" 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};