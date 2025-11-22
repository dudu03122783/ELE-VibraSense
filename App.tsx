import React, { useState, useEffect, useMemo } from 'react';
import FileUpload from './components/FileUpload';
import { TimeChart, FFTChart } from './components/Charts';
import { calculateFFT, calculateStats, downsampleData } from './utils/mathUtils';
import { analyzeWithGemini } from './services/geminiService';
import { ProcessedDataPoint, DataAxis, FFTResult, AnalysisStats, AIAnalysisResult } from './types';

const SAMPLE_RATE = 1600;

const App: React.FC = () => {
  const [data, setData] = useState<ProcessedDataPoint[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  
  // Windowing State
  const [windowStart, setWindowStart] = useState<number>(0); // in Seconds
  const [windowSize, setWindowSize] = useState<number>(4); // in Seconds
  const [selectedAxis, setSelectedAxis] = useState<DataAxis>('vz');
  
  // Visualization State
  const [displayData, setDisplayData] = useState<ProcessedDataPoint[]>([]);
  const [refLineLevel, setRefLineLevel] = useState<number | null>(null); // null, 10, or 15
  
  // AI State
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Colors mapping
  const colors: Record<DataAxis, string> = {
    ax: '#ef4444',
    ay: '#22c55e',
    az: '#3b82f6',
    vz: '#a855f7',
    sz: '#f97316',
  };

  // Prepare Display Data (Downsampled Global View)
  useEffect(() => {
    if (data) {
      // Downsample for responsive UI if data is large (> 10000 points)
      setDisplayData(downsampleData(data, 8000));
    } else {
      setDisplayData([]);
    }
  }, [data]);

  // Derived Data based on Window for FFT Analysis
  const currentWindowData = useMemo(() => {
    if (!data) return [];
    const startIndex = Math.floor(windowStart * SAMPLE_RATE);
    const endIndex = Math.floor((windowStart + windowSize) * SAMPLE_RATE);
    return data.slice(startIndex, Math.min(endIndex, data.length));
  }, [data, windowStart, windowSize]);

  // GLOBAL STATS: Calculated on the FULL dataset for the selected axis
  const globalStats = useMemo(() => {
    if (!data) return null;
    return calculateStats(data, selectedAxis);
  }, [data, selectedAxis]);

  // WINDOW STATS & FFT: Calculated only on the slice
  const { fftData, windowStats, peakFreq } = useMemo(() => {
    if (currentWindowData.length === 0) return { fftData: [], windowStats: null, peakFreq: null };

    const series = currentWindowData.map(d => d[selectedAxis]);
    const fft = calculateFFT(series, SAMPLE_RATE);
    // calculateStats used for RMS primarily here
    const stats = calculateStats(currentWindowData, selectedAxis);
    
    // Find max freq
    let maxMag = 0;
    let pFreq = 0;
    fft.forEach(f => {
      if(f.magnitude > maxMag) {
        maxMag = f.magnitude;
        pFreq = f.frequency;
      }
    });

    return { fftData: fft, windowStats: stats, peakFreq: { freq: pFreq, mag: maxMag } };
  }, [currentWindowData, selectedAxis]);

  const handleRunAI = async () => {
    if (!windowStats || !peakFreq) return;
    setIsAnalyzing(true);
    // We pass global stats to AI as well for context if needed, but focusing on window for now
    const result = await analyzeWithGemini({ ...windowStats, axis: selectedAxis }, peakFreq);
    setAiResult(result);
    setIsAnalyzing(false);
  };

  const handleChartClick = (clickedTime: number) => {
    if (!data) return;
    const maxStart = data[data.length - 1].time - windowSize;
    let newStart = clickedTime - (windowSize / 2);
    
    if (newStart < 0) newStart = 0;
    if (newStart > maxStart) newStart = maxStart;
    
    setWindowStart(newStart);
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-purple-500 to-blue-500"></div>
        <header className="p-6 flex justify-between items-center z-10">
          <h1 className="text-2xl font-mono font-bold tracking-tighter text-white">
            VIBRA<span className="text-teal-400">SENSE</span>.AI
          </h1>
        </header>
        <FileUpload onDataLoaded={(d, name) => { setData(d); setFileName(name); }} />
      </div>
    );
  }

  const maxTime = data[data.length - 1].time;
  const showRefLines = refLineLevel !== null && ['ax', 'ay', 'az'].includes(selectedAxis);
  const currentRefLines = showRefLines && refLineLevel ? [refLineLevel, -refLineLevel] : undefined;
  const unit = selectedAxis.startsWith('a') ? 'Gals' : selectedAxis === 'vz' ? 'm/s' : 'm';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-mono font-bold tracking-tighter">
              VIBRA<span className="text-teal-400">SENSE</span>.AI
            </h1>
            <div className="h-4 w-px bg-gray-700"></div>
            <span className="text-sm text-gray-400 font-mono">{fileName}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">
              {data.length.toLocaleString()} samples
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setData(null)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Close File
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel: Controls & Stats */}
        <aside className="w-full lg:w-80 bg-gray-900 border-r border-gray-800 flex flex-col overflow-y-auto z-40">
          <div className="p-6 space-y-8">
            {/* Axis Selection */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">Signal Channel</label>
              <div className="grid grid-cols-3 gap-2">
                {(['ax', 'ay', 'az', 'vz', 'sz'] as DataAxis[]).map(axis => (
                  <button
                    key={axis}
                    onClick={() => setSelectedAxis(axis)}
                    className={`px-3 py-2 rounded text-sm font-mono font-medium transition-all ${
                      selectedAxis === axis 
                        ? 'bg-gray-800 text-white ring-1 ring-gray-600 shadow-lg' 
                        : 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-300'
                    }`}
                    style={{ color: selectedAxis === axis ? colors[axis] : undefined }}
                  >
                    {axis.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Lines (Only for Accelerations) */}
            {['ax', 'ay', 'az'].includes(selectedAxis) && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">
                  Reference Lines (Gals)
                </label>
                <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                  {[null, 10, 15].map((level) => (
                    <button
                      key={level ?? 'off'}
                      onClick={() => setRefLineLevel(level)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded ${
                        refLineLevel === level 
                          ? 'bg-gray-700 text-white shadow-sm' 
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {level ? `±${level}` : 'Off'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Global Statistics Display (Sidebar) */}
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 backdrop-blur-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                Global Stats (ISO 18738)
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span className="text-xs text-gray-500">Max Pk-Pk</span>
                  </div>
                  <span className="font-mono text-sm text-white">
                    {globalStats?.pkPk.toFixed(3)} <span className="text-[10px] text-gray-600">{unit}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full border border-white border-dashed"></span>
                    <span className="text-xs text-gray-500">Max 0-Pk</span>
                  </div>
                  <span className="font-mono text-sm text-white">
                    {globalStats?.zeroPk.toFixed(3)} <span className="text-[10px] text-gray-600">{unit}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">A95 Pk-Pk</span>
                  <span className="font-mono text-sm text-white">
                    {globalStats?.a95.toFixed(3)} <span className="text-[10px] text-gray-600">{unit}</span>
                  </span>
                </div>
              </div>
              <div className="mt-3 text-[10px] text-gray-500 leading-tight">
                *Pk-Pk calc via Zero-Crossing method (Appendix A). Amber dots on chart show Max Pk-Pk pair.
              </div>
            </div>

            {/* Window Controls */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">
                FFT Analysis Window ({windowSize}s)
              </label>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Start: {windowStart.toFixed(2)}s</span>
                    <span>End: {(windowStart + windowSize).toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxTime - windowSize}
                    step={0.1}
                    value={windowStart}
                    onChange={(e) => setWindowStart(Number(e.target.value))}
                    className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                  />
                </div>
                <div className="flex gap-2">
                   {[1, 2, 4, 8].map(ws => (
                     <button
                      key={ws}
                      onClick={() => setWindowSize(ws)}
                      className={`flex-1 py-1 text-xs rounded border ${
                        windowSize === ws 
                          ? 'border-teal-500/50 bg-teal-500/10 text-teal-400' 
                          : 'border-gray-700 text-gray-500 hover:border-gray-600'
                      }`}
                     >
                       {ws}s
                     </button>
                   ))}
                </div>
              </div>
            </div>

            {/* Window Stats Card */}
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 backdrop-blur-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Window Analysis</h3>
              
              <div className="grid grid-cols-1 gap-y-4">
                <div>
                  <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Window RMS</div>
                  <div className="text-lg font-mono text-white">
                    {windowStats?.rms.toFixed(3)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Dominant Freq</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-mono text-teal-400 font-bold">
                      {peakFreq?.freq.toFixed(2)}
                    </span>
                    <span className="text-sm text-gray-400">Hz</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Mag: {peakFreq?.mag.toFixed(4)}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Analysis Button */}
            <div>
              <button
                onClick={handleRunAI}
                disabled={isAnalyzing || !process.env.API_KEY}
                className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                  isAnalyzing 
                    ? 'bg-gray-800 text-gray-400 cursor-wait'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI Diagnostics
                  </>
                )}
              </button>
              {!process.env.API_KEY && (
                <p className="text-[10px] text-center text-gray-600 mt-2">API Key not configured in env</p>
              )}
            </div>

            {/* AI Result Display */}
            {aiResult && (
              <div className={`rounded-xl p-4 border backdrop-blur-sm ${
                aiResult.status === 'safe' ? 'bg-green-900/20 border-green-800' :
                aiResult.status === 'danger' ? 'bg-red-900/20 border-red-800' :
                'bg-yellow-900/20 border-yellow-800'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${
                    aiResult.status === 'safe' ? 'bg-green-500' :
                    aiResult.status === 'danger' ? 'bg-red-500' :
                    'bg-yellow-500'
                  }`}></div>
                  <span className="text-xs font-bold uppercase tracking-wider">{aiResult.status}</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed mb-3">
                  {aiResult.summary}
                </p>
                <ul className="space-y-1">
                  {aiResult.recommendations.map((rec, i) => (
                    <li key={i} className="text-[10px] text-gray-400 flex items-start gap-1.5">
                      <span className="mt-0.5 text-gray-600">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content: Charts */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-950 relative">
           {/* Grid Background */}
           <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ 
               backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
               backgroundSize: '40px 40px'
             }}>
           </div>

           <div className="flex-1 flex flex-col p-4 gap-4 h-full">
              {/* Top: Time Domain */}
              <div className="flex-1 bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex flex-col min-h-0 relative overflow-hidden group">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-sm font-bold text-gray-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{backgroundColor: colors[selectedAxis]}}></span>
                    GLOBAL TIME DOMAIN
                  </h2>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-teal-500 bg-teal-500/10 px-2 py-1 rounded border border-teal-500/20">
                      Tip: Use bottom slider to Zoom/Pan
                    </span>
                    <span className="text-xs text-gray-600 font-mono">Unit: {unit}</span>
                  </div>
                </div>
                <div className="flex-1 min-h-0 cursor-crosshair relative">
                  <TimeChart 
                    data={displayData} 
                    axis={selectedAxis} 
                    color={colors[selectedAxis]}
                    windowRange={{ start: windowStart, end: windowStart + windowSize }}
                    referenceLines={currentRefLines}
                    onChartClick={handleChartClick}
                    globalStats={globalStats}
                  />
                </div>
              </div>

              {/* Bottom: Frequency Domain */}
              <div className="flex-1 bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-sm font-bold text-gray-400 flex items-center gap-2">
                     <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                       <path d="M21 12V7H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14" />
                       <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                       <path d="M18 12c0-2.2-1.8-4-4-4s-4 1.8-4 4 1.8 4 4 4 4-1.8 4-4Z" />
                     </svg>
                     FFT ANALYSIS (WINDOWED)
                  </h2>
                  <span className="text-xs text-gray-600 font-mono">Range: 1-200Hz</span>
                </div>
                <div className="flex-1 min-h-0">
                  <FFTChart 
                    data={fftData} 
                    color={colors[selectedAxis]} 
                  />
                </div>
              </div>
           </div>
        </div>
      </main>
    </div>
  );
};

export default App;