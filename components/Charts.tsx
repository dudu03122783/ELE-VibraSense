
import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ReferenceArea, ReferenceLine, Label, ReferenceDot
} from 'recharts';
import { FFTResult, ProcessedDataPoint, DataAxis, AnalysisStats } from '../types';

interface VerticalLineDef {
  x: number;
  color: string;
  label?: string;
  dash?: string;
}

interface HighlightAreaDef {
  x1: number;
  x2: number;
  color: string;
}

interface TimeChartProps {
  data: ProcessedDataPoint[];
  axis: DataAxis;
  color: string;
  syncId?: string;
  windowRange?: { start: number; end: number };
  referenceLines?: number[]; // Horizontal lines (e.g. +/- 10)
  verticalLines?: VerticalLineDef[]; // Vertical lines (e.g. ISO limits)
  highlightAreas?: HighlightAreaDef[]; // Vertical areas (e.g. Const Vel region)
  onChartClick?: (time: number) => void;
  globalStats?: AnalysisStats | null;
  yDomain?: [number | 'auto', number | 'auto'];
  xDomain?: [number, number]; // New prop for Zoom control
  onZoom?: (left: number, right: number) => void; // Callback for zoom
  gridColor?: string;
  textColor?: string;
  brushColor?: string;
}

const formatYAxis = (val: number) => {
  if (val === 0) return "0.00";
  return val.toFixed(2);
};

export const TimeChart: React.FC<TimeChartProps> = ({ 
  data, 
  axis, 
  color, 
  syncId,
  windowRange,
  referenceLines,
  verticalLines,
  highlightAreas,
  onChartClick,
  globalStats,
  yDomain = ['auto', 'auto'],
  xDomain,
  onZoom,
  gridColor = "#374151",
  textColor = "#9ca3af",
  brushColor = "#9ca3af"
}) => {
  const unit = axis.startsWith('a') ? 'Gals' : axis === 'vz' ? 'm/s' : 'm';

  // Internal state for drag-to-zoom interaction
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);

  const handleMouseDown = (e: any) => {
    if (e && e.activeLabel) {
      setRefAreaLeft(Number(e.activeLabel));
    }
  };

  const handleMouseMove = (e: any) => {
    if (refAreaLeft !== null && e && e.activeLabel) {
      setRefAreaRight(Number(e.activeLabel));
    }
  };

  const handleMouseUp = () => {
    if (refAreaLeft !== null && refAreaRight !== null && onZoom) {
      const [left, right] = [refAreaLeft, refAreaRight].sort((a, b) => a - b);
      if (right > left) {
        onZoom(left, right);
      }
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  return (
    <div className="h-full w-full relative select-none">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={data} 
          syncId={syncId}
          onMouseDown={onZoom ? handleMouseDown : undefined}
          onMouseMove={onZoom ? handleMouseMove : undefined}
          onMouseUp={onZoom ? handleMouseUp : undefined}
          onClick={(e) => {
            // Only trigger click if we weren't dragging (zooming)
            if (!refAreaLeft && onChartClick && e && e.activeLabel) {
              onChartClick(Number(e.activeLabel));
            }
          }}
          margin={{ top: 20, right: 40, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
          <XAxis 
            dataKey="time" 
            type="number" 
            domain={xDomain || ['dataMin', 'dataMax']} 
            allowDataOverflow={true}
            hide={false} 
            stroke={textColor}
            fontSize={10}
            tickFormatter={(val) => val.toFixed(1) + 's'}
            minTickGap={50}
          />
          <YAxis 
            stroke={textColor} 
            fontSize={13} // Increased font size
            tickFormatter={formatYAxis}
            width={60}
            allowDataOverflow={true}
            domain={yDomain}
          >
             <Label 
               value={unit} 
               angle={-90} 
               position="insideLeft" 
               style={{ textAnchor: 'middle', fill: textColor, fontSize: 12 }} 
             />
          </YAxis>
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.9)', border: `1px solid ${gridColor}`, color: '#fff' }}
            labelStyle={{ color: textColor }}
            itemStyle={{ color: color }}
            formatter={(value: number) => [formatYAxis(value), axis.toUpperCase()]}
            labelFormatter={(label) => `Time: ${Number(label).toFixed(3)}s`}
          />
          
          {/* ISO Highlights (Background) */}
          {highlightAreas && highlightAreas.map((area, idx) => (
             <ReferenceArea
               key={`area-${idx}`}
               x1={area.x1}
               x2={area.x2}
               fill={area.color}
               fillOpacity={0.15}
               ifOverflow="extendDomain"
             />
          ))}

          {/* Analysis Window Highlight */}
          {windowRange && (
            <ReferenceArea 
              x1={windowRange.start} 
              x2={windowRange.end} 
              fill={color} 
              fillOpacity={0.1}
              stroke={color}
              strokeOpacity={0.3}
              ifOverflow="extendDomain"
            />
          )}

          {/* Zoom Selection Highlight */}
          {refAreaLeft !== null && refAreaRight !== null && (
            <ReferenceArea 
              x1={refAreaLeft} 
              x2={refAreaRight} 
              strokeOpacity={0.3} 
              fill={textColor}
              fillOpacity={0.3} 
            />
          )}

          <Line 
            type="monotone" 
            dataKey={axis} 
            stroke={color} 
            strokeWidth={1.5} 
            dot={false} 
            isAnimationActive={false} 
          />

          {/* Horizontal Reference Lines */}
          {referenceLines && referenceLines.map((val, idx) => (
             <ReferenceLine key={`href-${idx}`} y={val} stroke="#ef4444" strokeWidth={2} strokeDasharray="4 2" opacity={1}>
               <Label value={val.toString()} position="right" fill="#ef4444" fontSize={10} fontWeight="bold" />
             </ReferenceLine>
          ))}

          {/* Vertical ISO Lines */}
          {verticalLines && verticalLines.map((line, idx) => (
            <ReferenceLine 
              key={`vref-${idx}`} 
              x={line.x} 
              stroke={line.color} 
              strokeWidth={2} 
              strokeDasharray={line.dash}
              opacity={0.8}
            >
              {line.label && (
                <Label 
                  value={line.label} 
                  position="insideTopRight" 
                  fill={line.color} 
                  fontSize={10} 
                  fontWeight="bold"
                  angle={-90} 
                  offset={10}
                />
              )}
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
              ifOverflow="hidden" // Hide if outside current zoom
            >
              <Label 
                value={`0-Pk: ${globalStats.zeroPk.toFixed(2)}`} 
                position="top" 
                fill={textColor} 
                fontSize={12} 
                fontWeight="bold"
                offset={10}
              />
            </ReferenceDot>
          )}

          {globalStats?.maxPkPkPair && (
            <>
              <ReferenceDot 
                x={globalStats.maxPkPkPair[0].time} 
                y={globalStats.maxPkPkPair[0].value} 
                r={4} 
                fill="#fbbf24" 
                stroke="none"
                ifOverflow="hidden"
              >
                {/* Show Label on the first point of the pair */}
                <Label 
                  value={`Pk-Pk: ${globalStats.pkPk.toFixed(2)}`} 
                  position="top" 
                  fill={textColor} 
                  fontSize={12} 
                  fontWeight="bold" 
                  offset={10}
                />
              </ReferenceDot>
              <ReferenceDot 
                x={globalStats.maxPkPkPair[1].time} 
                y={globalStats.maxPkPkPair[1].value} 
                r={4} 
                fill="#fbbf24" 
                stroke="none"
                ifOverflow="hidden"
              />
            </>
          )}
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
  
  // Get top 3 peaks
  const top3Peaks = [...data]
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 3);

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
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
            fontSize={12} 
            tickFormatter={formatYAxis}
            width={50}
          />
          <Tooltip 
            cursor={{stroke: textColor, strokeWidth: 1, strokeDasharray: '3 3'}}
            contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.9)', border: `1px solid ${gridColor}`, color: '#fff' }}
            formatter={(value: number) => [`${value.toFixed(2)} Gals`, 'Magnitude']}
            labelFormatter={(label) => `Freq: ${Number(label).toFixed(1)} Hz`}
          />
          <Area 
            type="monotone" 
            dataKey="magnitude" 
            stroke={color} 
            fillOpacity={1} 
            fill={`url(#colorSplit-${color})`} 
            isAnimationActive={false}
          />
          
          {top3Peaks.map((point, index) => (
             point.magnitude > 0 && (
              <ReferenceDot 
                key={index}
                x={point.frequency} 
                y={point.magnitude} 
                r={4} 
                fill={color} 
                stroke="#fff" 
                strokeWidth={2}
              >
                 <Label 
                   value={`${point.magnitude.toFixed(2)} Gals, ${point.frequency.toFixed(1)} Hz`} 
                   position="top" 
                   fill={textColor} 
                   fontSize={12} 
                   fontWeight="bold"
                 />
              </ReferenceDot>
             )
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
