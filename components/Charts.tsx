
import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ReferenceArea, ReferenceLine, Brush, Label, ReferenceDot
} from 'recharts';
import { FFTResult, ProcessedDataPoint, DataAxis, AnalysisStats } from '../types';

interface TimeChartProps {
  data: ProcessedDataPoint[];
  axis: DataAxis;
  color: string;
  syncId?: string;
  windowRange?: { start: number; end: number };
  referenceLines?: number[];
  onChartClick?: (time: number) => void;
  globalStats?: AnalysisStats | null;
  yDomain?: [number | 'auto', number | 'auto'];
  gridColor?: string;
  textColor?: string;
  brushColor?: string;
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
  globalStats,
  yDomain = ['auto', 'auto'],
  gridColor = "#374151",
  textColor = "#9ca3af",
  brushColor = "#9ca3af"
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
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
          <XAxis 
            dataKey="time" 
            type="number" 
            domain={['dataMin', 'dataMax']} 
            hide={false} 
            stroke={textColor}
            fontSize={10}
            tickFormatter={(val) => val.toFixed(1) + 's'}
            minTickGap={50}
          />
          <YAxis 
            stroke={textColor} 
            fontSize={11} 
            tickFormatter={formatScientificIfNeeded}
            domain={yDomain}
            width={60}
            allowDataOverflow={true}
          >
             <Label 
               value={unit} 
               angle={-90} 
               position="insideLeft" 
               style={{ textAnchor: 'middle', fill: textColor, fontSize: 10 }} 
             />
          </YAxis>
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.9)', border: `1px solid ${gridColor}`, color: '#fff' }}
            labelStyle={{ color: textColor }}
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
            isAnimationActive={false} 
          />
          {windowRange && (
            <ReferenceArea 
              x1={windowRange.start} 
              x2={windowRange.end} 
              fill={color} 
              fillOpacity={0.1}
              stroke={color}
              strokeOpacity={0.3}
            />
          )}
          {referenceLines && referenceLines.map((val, idx) => (
             <ReferenceLine key={idx} y={val} stroke="#ef4444" strokeDasharray="3 3" opacity={0.7}>
               <Label value={val.toString()} position="right" fill="#ef4444" fontSize={10} />
             </ReferenceLine>
          ))}
          
          {globalStats?.max0PkPoint && (
            <ReferenceDot 
              x={globalStats.max0PkPoint.time} 
              y={globalStats.max0PkPoint.value} 
              r={5} 
              fill="transparent"
              stroke={textColor}
              strokeWidth={2}
              strokeDasharray="3 3"
            />
          )}

          {globalStats?.maxPkPkPair && (
            <>
              <ReferenceDot 
                x={globalStats.maxPkPkPair[0].time} 
                y={globalStats.maxPkPkPair[0].value} 
                r={4} 
                fill="#fbbf24" 
                stroke="none"
              />
              <ReferenceDot 
                x={globalStats.maxPkPkPair[1].time} 
                y={globalStats.maxPkPkPair[1].value} 
                r={4} 
                fill="#fbbf24" 
                stroke="none"
              />
            </>
          )}

          <Brush 
            dataKey="time" 
            height={30} 
            stroke={brushColor}
            fill="rgba(255,255,255,0.05)"
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
  gridColor?: string;
  textColor?: string;
}

export const FFTChart: React.FC<FFTChartProps> = ({ 
  data, 
  color,
  gridColor = "#374151",
  textColor = "#9ca3af"
}) => {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id={`colorSplit-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
          <XAxis 
            dataKey="frequency" 
            type="number" 
            stroke={textColor} 
            fontSize={11}
            tickCount={10}
            label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -5, fill: textColor }}
          />
          <YAxis 
            stroke={textColor} 
            fontSize={11}
            tickFormatter={formatScientificIfNeeded}
            width={50}
          />
          <Tooltip 
            cursor={{stroke: textColor, strokeWidth: 1, strokeDasharray: '3 3'}}
            contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.9)', border: `1px solid ${gridColor}`, color: '#fff' }}
            formatter={(value: number) => [value.toFixed(4), 'Magnitude']}
            labelFormatter={(label) => `Freq: ${Number(label).toFixed(2)}Hz`}
          />
          <Area 
            type="monotone" 
            dataKey="magnitude" 
            stroke={color} 
            fillOpacity={1} 
            fill={`url(#colorSplit-${color})`} 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
