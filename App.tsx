
import React, { useState, useEffect, useMemo } from 'react';
import FileUpload from './components/FileUpload';
import { TimeChart, FFTChart } from './components/Charts';
import { calculateFFT, calculateStats, downsampleData, parseCSV, processVibrationData } from './utils/mathUtils';
import { applyFilters } from './utils/dspUtils';
import { analyzeWithGemini } from './services/geminiService';
import { ProcessedDataPoint, DataAxis, AnalysisStats, AIAnalysisResult, ThemeConfig, FilterConfig, RawDataPoint } from './types';

const SAMPLE_RATE = 1600;

// --- TRANSLATIONS ---
const TRANSLATIONS = {
  zh: {
    title: 'VIBRASENSE.AI',
    upload: '上传文件',
    theme: '主题',
    close: '关闭文件',
    globalStats: '全局统计',
    windowAnalysis: '窗口分析 (FFT)',
    windowControl: '分析窗口控制',
    chartHeight: '图表高度',
    aiDiag: 'AI 智能诊断',
    analyzing: '分析中...',
    kinematics: '运动学',
    vibration: '振动',
    fft: '频谱分析',
    yScale: 'Y轴范围',
    refLines: '参考线',
    dominant: '主频',
    unitAccel: 'Gals',
    maxPkPk: '最大峰峰值 (Max Pk-Pk)',
    max0Pk: '最大单峰值 (Max 0-Pk)',
    a95: 'A95 峰峰值',
    rms: '时间平均计权值 (aw)',
    peak: '峰值 (Peak)',
    dragDrop: '拖拽或点击上传',
    supports: '支持 .csv 格式 (包含 ax, ay, az 列)',
    systemInfo: '系统将自动通过积分计算速度(Vz)和位移(Sz)',
    dsp: '信号处理 / 滤波器',
    enableFilter: '启用滤波',
    highPass: '高通 (Hz)',
    lowPass: '低通 (Hz)',
    presetIso: 'GB/T 24474 (10Hz)',
    presetDefault: '复位 (全通)',
    target: '目标',
    targetAll: '所有轴',
    targetZ: '仅 Z 轴'
  },
  en: {
    title: 'VIBRASENSE.AI',
    upload: 'Upload File',
    theme: 'Theme',
    close: 'Close File',
    globalStats: 'Global Stats',
    windowAnalysis: 'Window Analysis (FFT)',
    windowControl: 'Analysis Window',
    chartHeight: 'Chart Height',
    aiDiag: 'AI Diagnostics',
    analyzing: 'Analyzing...',
    kinematics: 'KINEMATICS',
    vibration: 'VIBRATION',
    fft: 'FREQUENCY ANALYSIS',
    yScale: 'Y-SCALE',
    refLines: 'Ref Lines',
    dominant: 'Dominant',
    unitAccel: 'Gals',
    maxPkPk: 'Max Pk-Pk',
    max0Pk: 'Max 0-Pk',
    a95: 'A95 Pk-Pk',
    rms: 'Time-Averaged Weighted (aw)',
    peak: 'Peak',
    dragDrop: 'Drag & Drop or Click to Upload',
    supports: 'Supports .csv (ax, ay, az)',
    systemInfo: 'The system will automatically calculate Velocity (Vz) and Displacement (Sz) via integration.',
    dsp: 'Signal Processing / Filters',
    enableFilter: 'Enable Filtering',
    highPass: 'High Pass (Hz)',
    lowPass: 'Low Pass (Hz)',
    presetIso: 'GB/T 24474 (10Hz)',
    presetDefault: 'Reset',
    target: 'Target',
    targetAll: 'All Axes',
    targetZ: 'Z-Axis Only'
  }
};

// --- THEME DEFINITIONS ---
const THEMES: ThemeConfig[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    bgApp: 'bg-gray-950',
    bgCard: 'bg-gray-900/50',
    bgPanel: 'bg-gray-900',
    textPrimary: 'text-gray-100',
    textSecondary: 'text-gray-400',
    border: 'border-gray-800',
    accent: 'text-teal-400',
    gridColor: '#374151',
    brushColor: '#6b7280',
    textColorHex: '#9ca3af', // gray-400
    chartColors: { ax: '#ef4444', ay: '#22c55e', az: '#3b82f6', vz: '#a855f7', sz: '#f97316' }
  },
  {
    id: 'antigravity',
    name: 'Antigravity (Default)',
    bgApp: 'bg-slate-950',
    bgCard: 'bg-slate-900/80',
    bgPanel: 'bg-slate-900',
    textPrimary: 'text-slate-100',
    textSecondary: 'text-slate-400',
    border: 'border-slate-700',
    accent: 'text-fuchsia-400',
    gridColor: '#475569',
    brushColor: '#cbd5e1',
    textColorHex: '#cbd5e1', // slate-300 - High visibility on dark
    chartColors: { ax: '#f472b6', ay: '#4ade80', az: '#22d3ee', vz: '#c084fc', sz: '#fbbf24' }
  },
  {
    id: 'engineering',
    name: 'Engineering',
    bgApp: 'bg-gray-100',
    bgCard: 'bg-white shadow-sm',
    bgPanel: 'bg-white',
    textPrimary: 'text-gray-900',
    textSecondary: 'text-gray-500',
    border: 'border-gray-200',
    accent: 'text-blue-600',
    gridColor: '#e5e7eb',
    brushColor: '#6b7280',
    textColorHex: '#374151', // gray-700
    chartColors: { ax: '#dc2626', ay: '#16a34a', az: '#2563eb', vz: '#7c3aed', sz: '#d97706' }
  }
];

const App: React.FC = () => {
  // Language State
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const t = TRANSLATIONS[lang];

  // Data State
  const [rawData, setRawData] = useState<RawDataPoint[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [displayData, setDisplayData] = useState<ProcessedDataPoint[]>([]);
  const [finalProcessedData, setFinalProcessedData] = useState<ProcessedDataPoint[] | null>(null);

  // DSP State
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({
    enabled: false,
    highPassFreq: 0,
    lowPassFreq: 80,
    isStandardWeighting: false,
    targetAxes: 'all'
  });

  // Theme State - Default to Antigravity
  const [currentThemeId, setCurrentThemeId] = useState<string>('antigravity');
  const theme = useMemo(() => THEMES.find(t => t.id === currentThemeId) || THEMES[0], [currentThemeId]);

  // Axis Selection State
  const [accelAxis, setAccelAxis] = useState<DataAxis>('az');
  const [intAxis, setIntAxis] = useState<DataAxis>('vz');

  // Y-Axis Control State
  const [yMinAccel, setYMinAccel] = useState<string>('');
  const [yMaxAccel, setYMaxAccel] = useState<string>('');
  const [yMinInt, setYMinInt] = useState<string>('');
  const [yMaxInt, setYMaxInt] = useState<string>('');
  
  // Chart Height State
  const [chartHeight, setChartHeight] = useState<number>(350);

  // Windowing State
  const [windowStart, setWindowStart] = useState<number>(0);
  const [windowSize, setWindowSize] = useState<number>(4);
  
  // Analysis State
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [refLineLevel, setRefLineLevel] = useState<number | null>(null);

  // --- DATA PIPELINE ---
  const handleFileLoad = (processed: ProcessedDataPoint[], name: string) => {
    // Treat initial load as Raw
    const raw: RawDataPoint[] = processed.map(p => ({ time: p.time, ax: p.ax, ay: p.ay, az: p.az }));
    setRawData(raw);
    setFileName(name);
  };

  useEffect(() => {
    if (!rawData) return;

    let dataToProcess = rawData;

    // Apply DSP if enabled
    if (filterConfig.enabled) {
      dataToProcess = applyFilters(rawData, SAMPLE_RATE, filterConfig);
    }

    // Integrate
    const processed = processVibrationData(dataToProcess, SAMPLE_RATE);
    setFinalProcessedData(processed);

  }, [rawData, filterConfig]);

  useEffect(() => {
    if (finalProcessedData) {
      setDisplayData(downsampleData(finalProcessedData, 8000));
    } else {
      setDisplayData([]);
    }
  }, [finalProcessedData]);

  // --- COMPUTED DATA ---
  const currentWindowData = useMemo(() => {
    if (!finalProcessedData) return [];
    const startIndex = Math.floor(windowStart * SAMPLE_RATE);
    const endIndex = Math.floor((windowStart + windowSize) * SAMPLE_RATE);
    return finalProcessedData.slice(startIndex, Math.min(endIndex, finalProcessedData.length));
  }, [finalProcessedData, windowStart, windowSize]);

  const globalStats = useMemo(() => {
    if (!finalProcessedData) return null;
    return calculateStats(finalProcessedData, accelAxis);
  }, [finalProcessedData, accelAxis]);

  const { fftData, windowStats, peakFreq } = useMemo(() => {
    if (currentWindowData.length === 0) return { fftData: [], windowStats: null, peakFreq: null };

    const series = currentWindowData.map(d => d[accelAxis]);
    const fft = calculateFFT(series, SAMPLE_RATE);
    const stats = calculateStats(currentWindowData, accelAxis);
    
    let maxMag = 0, pFreq = 0;
    fft.forEach(f => {
      if(f.magnitude > maxMag) {
        maxMag = f.magnitude;
        pFreq = f.frequency;
      }
    });

    return { fftData: fft, windowStats: stats, peakFreq: { freq: pFreq, mag: maxMag } };
  }, [currentWindowData, accelAxis]);

  // --- HANDLERS ---
  const handleRunAI = async () => {
    if (!windowStats || !peakFreq) return;
    setIsAnalyzing(true);
    const result = await analyzeWithGemini({ ...windowStats, axis: accelAxis }, peakFreq);
    setAiResult(result);
    setIsAnalyzing(false);
  };

  const handleChartClick = (clickedTime: number) => {
    if (!finalProcessedData) return;
    const maxStart = finalProcessedData[finalProcessedData.length - 1].time - windowSize;
    let newStart = clickedTime - (windowSize / 2);
    if (newStart < 0) newStart = 0;
    if (newStart > maxStart) newStart = maxStart;
    setWindowStart(newStart);
  };

  const parseDomain = (min: string, max: string): [number | 'auto', number | 'auto'] => {
    const pMin = min === '' || isNaN(Number(min)) ? 'auto' : Number(min);
    const pMax = max === '' || isNaN(Number(max)) ? 'auto' : Number(max);
    return [pMin, pMax];
  };

  const applyIsoPreset = () => {
    setFilterConfig({
      enabled: true,
      highPassFreq: 0,
      lowPassFreq: 10,
      isStandardWeighting: true,
      targetAxes: 'z-only' // ISO 18738 / GB/T 24474 focus on Z for ride quality
    });
  };

  const resetFilters = () => {
    setFilterConfig({
      enabled: false,
      highPassFreq: 0,
      lowPassFreq: 80,
      isStandardWeighting: false,
      targetAxes: 'all'
    });
  };

  if (!finalProcessedData) {
    return (
      <div className={`min-h-screen ${theme.bgApp} flex flex-col relative overflow-hidden`}>
        <div className="absolute top-4 right-4 z-50">
          <button onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} className="text-white bg-gray-800 px-3 py-1 rounded text-sm border border-gray-700">
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
        <FileUpload onDataLoaded={handleFileLoad} />
        <div className="absolute bottom-8 text-center w-full text-gray-500 text-xs">
           <p>{t.dragDrop}</p>
           <p>{t.systemInfo}</p>
        </div>
      </div>
    );
  }

  const maxTime = finalProcessedData[finalProcessedData.length - 1].time;

  return (
    <div className={`min-h-screen ${theme.bgApp} ${theme.textPrimary} font-sans flex flex-col overflow-y-auto`}>
      
      {/* --- HEADER --- */}
      <header className={`border-b ${theme.border} ${theme.bgCard} backdrop-blur-md sticky top-0 z-50`}>
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-mono font-bold tracking-tighter">
              VIBRA<span className={theme.accent}>SENSE</span>.AI
            </h1>
            <div className="h-4 w-px bg-gray-600"></div>
            <span className={`text-sm ${theme.textSecondary} font-mono`}>{fileName}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              className={`text-xs font-bold px-2 py-1 rounded border ${theme.border} ${theme.textPrimary} hover:bg-white/5`}
            >
              {lang === 'zh' ? 'EN' : '中文'}
            </button>
            <div className="h-4 w-px bg-gray-600"></div>
            <div className="flex items-center gap-2">
              <span className={`text-xs uppercase font-bold ${theme.textSecondary}`}>{t.theme}</span>
              <select 
                value={currentThemeId} 
                onChange={(e) => setCurrentThemeId(e.target.value)}
                className={`text-xs p-1 rounded border ${theme.border} bg-transparent ${theme.textPrimary}`}
              >
                {THEMES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="h-4 w-px bg-gray-600"></div>
            <button 
              onClick={() => { setRawData(null); setFinalProcessedData(null); }}
              className={`text-sm ${theme.textSecondary} hover:${theme.textPrimary} transition-colors`}
            >
              {t.close}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row">
        {/* --- LEFT SIDEBAR --- */}
        <aside className={`w-full lg:w-80 ${theme.bgPanel} border-r ${theme.border} flex flex-col z-40 shrink-0`}>
          <div className="p-6 space-y-6 sticky top-0">
            
            {/* 1. Global Stats */}
            <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} shadow-sm`}>
              <h3 className={`text-xs font-bold ${theme.textSecondary} uppercase mb-3 flex items-center gap-2`}>
                <span className={`w-1.5 h-1.5 rounded-full ${theme.accent.replace('text-', 'bg-')}`}></span>
                {t.globalStats} ({accelAxis.toUpperCase()})
              </h3>
              <div className="space-y-2">
                <div className={`flex justify-between items-center border-b ${theme.border} pb-1`}>
                   <span className={`text-xs ${theme.textSecondary}`}>{t.maxPkPk}</span>
                   <span className="font-mono text-sm">{globalStats?.pkPk.toFixed(3)}</span>
                </div>
                <div className={`flex justify-between items-center border-b ${theme.border} pb-1`}>
                   <span className={`text-xs ${theme.textSecondary}`}>{t.max0Pk}</span>
                   <span className="font-mono text-sm">{globalStats?.zeroPk.toFixed(3)}</span>
                </div>
                <div className={`flex justify-between items-center border-b ${theme.border} pb-1`}>
                   <span className={`text-xs ${theme.textSecondary}`}>{t.a95}</span>
                   <span className="font-mono text-sm">{globalStats?.a95.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                   <span className={`text-xs ${theme.accent} font-bold`}>{t.rms}</span>
                   <span className={`font-mono text-sm ${theme.accent}`}>{globalStats?.rms.toFixed(3)}</span>
                </div>
              </div>
            </div>

            {/* 2. Window Stats & Controls (FFT) */}
            {windowStats && (
              <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} shadow-sm`}>
                <h3 className={`text-xs font-bold ${theme.textSecondary} uppercase mb-3 flex items-center gap-2`}>
                  <span className={`w-1.5 h-1.5 rounded-full bg-purple-500`}></span>
                  {t.windowAnalysis}
                </h3>
                <div className="space-y-2">
                   <div className={`flex justify-between items-center border-b ${theme.border} pb-1`}>
                     <span className={`text-xs ${theme.textSecondary}`}>{t.rms}</span>
                     <span className="font-mono text-sm">{windowStats.rms.toFixed(3)}</span>
                   </div>
                   <div className={`flex justify-between items-center border-b ${theme.border} pb-1`}>
                     <span className={`text-xs ${theme.textSecondary}`}>{t.peak}</span>
                     <span className="font-mono text-sm">{windowStats.peakVal.toFixed(3)}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className={`text-xs ${theme.textSecondary}`}>{t.dominant}</span>
                     <span className="font-mono text-sm text-yellow-500">{peakFreq?.freq.toFixed(2)} Hz</span>
                   </div>
                </div>
              </div>
            )}

            {/* 3. Window Control */}
            <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} shadow-sm`}>
              <label className={`text-xs font-bold ${theme.textSecondary} uppercase tracking-wider mb-3 block`}>
                {t.windowControl}
              </label>
              <div className="space-y-4">
                <input
                  type="range"
                  min={0}
                  max={maxTime - windowSize}
                  step={0.1}
                  value={windowStart}
                  onChange={(e) => setWindowStart(Number(e.target.value))}
                  className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${theme.bgCard}`}
                />
                <div className="flex justify-between text-xs font-mono">
                  <span>{windowStart.toFixed(2)}s</span>
                  <span>{(windowStart + windowSize).toFixed(2)}s</span>
                </div>
                <div className="flex gap-2">
                   {[1, 2, 4, 8].map(ws => (
                     <button
                      key={ws}
                      onClick={() => setWindowSize(ws)}
                      className={`flex-1 py-1 text-xs rounded border ${
                        windowSize === ws 
                          ? `${theme.border} ${theme.accent} font-bold bg-opacity-10` 
                          : `${theme.border} ${theme.textSecondary}`
                      }`}
                     >
                       {ws}s
                     </button>
                   ))}
                </div>
              </div>
            </div>

            {/* 4. DSP Panel (Moved Here) */}
            <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} shadow-sm`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className={`text-xs font-bold ${theme.textSecondary} uppercase flex items-center gap-2`}>
                  <span className={`w-1.5 h-1.5 rounded-full bg-blue-500`}></span>
                  {t.dsp}
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[10px] font-bold">{t.enableFilter}</span>
                  <input 
                    type="checkbox" 
                    checked={filterConfig.enabled}
                    onChange={(e) => setFilterConfig({...filterConfig, enabled: e.target.checked})}
                    className="rounded border-gray-600 bg-gray-800"
                  />
                </label>
              </div>
              
              <div className={`space-y-3 ${!filterConfig.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500 block mb-1">{t.highPass}</label>
                    <input 
                      type="number" 
                      value={filterConfig.highPassFreq}
                      onChange={(e) => setFilterConfig({...filterConfig, highPassFreq: Number(e.target.value)})}
                      className={`w-full text-xs p-1 rounded border ${theme.border} bg-transparent ${theme.textPrimary}`}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500 block mb-1">{t.lowPass}</label>
                    <input 
                      type="number" 
                      value={filterConfig.lowPassFreq}
                      onChange={(e) => setFilterConfig({...filterConfig, lowPassFreq: Number(e.target.value)})}
                      className={`w-full text-xs p-1 rounded border ${theme.border} bg-transparent ${theme.textPrimary}`}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                     <label className="text-[10px] text-gray-500 block mb-1">{t.target}</label>
                     <select 
                       value={filterConfig.targetAxes}
                       onChange={(e) => setFilterConfig({...filterConfig, targetAxes: e.target.value as 'all' | 'z-only'})}
                       className={`w-full text-xs p-1 rounded border ${theme.border} bg-transparent ${theme.textPrimary}`}
                     >
                       <option value="all">{t.targetAll}</option>
                       <option value="z-only">{t.targetZ}</option>
                     </select>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-1">
                   <button 
                     onClick={applyIsoPreset}
                     className={`flex-1 py-1 px-2 text-[10px] rounded border ${theme.border} hover:bg-white/10 ${filterConfig.isStandardWeighting && filterConfig.enabled ? theme.accent : ''}`}
                   >
                     {t.presetIso}
                   </button>
                   <button 
                     onClick={resetFilters}
                     className={`py-1 px-2 text-[10px] rounded border ${theme.border} hover:bg-white/10`}
                   >
                     {t.presetDefault}
                   </button>
                </div>
              </div>
            </div>

            {/* 5. Chart Height */}
            <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} shadow-sm`}>
              <label className={`text-xs font-bold ${theme.textSecondary} uppercase tracking-wider mb-3 block`}>
                 {t.chartHeight} ({chartHeight}px)
              </label>
              <input 
                type="range" min="200" max="600" step="50" 
                value={chartHeight} onChange={(e) => setChartHeight(Number(e.target.value))}
                className="w-full"
              />
            </div>

             {/* 6. AI Analysis */}
             <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} shadow-sm`}>
              <button
                onClick={handleRunAI}
                disabled={isAnalyzing || !process.env.API_KEY}
                className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                  isAnalyzing 
                    ? 'bg-gray-800 text-gray-400 cursor-wait'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                }`}
              >
                {isAnalyzing ? t.analyzing : t.aiDiag}
              </button>
              
              {aiResult && (
                <div className={`mt-4 pt-4 border-t ${theme.border}`}>
                   <div className={`text-xs font-bold uppercase mb-2 ${
                     aiResult.status === 'safe' ? 'text-green-500' : 'text-yellow-500'
                   }`}>{aiResult.status}</div>
                   <p className={`text-xs ${theme.textSecondary}`}>{aiResult.summary}</p>
                </div>
              )}
            </div>

          </div>
        </aside>

        {/* --- MAIN CHARTS AREA --- */}
        <div className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto min-w-0">
            
            {/* VIBRATION CHART */}
            <div className={`${theme.bgCard} border ${theme.border} rounded-xl p-4 shadow-sm flex flex-col`} style={{ height: chartHeight }}>
              <div className="flex justify-between items-center mb-4 shrink-0">
                <div className="flex items-center gap-4">
                  <h2 className={`text-sm font-bold ${theme.textSecondary} flex items-center gap-2`}>
                    <span className="w-2 h-2 rounded-sm" style={{backgroundColor: theme.chartColors[accelAxis]}}></span>
                    {t.vibration}
                    {filterConfig.enabled && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded ml-1">
                        Filtered ({filterConfig.targetAxes === 'z-only' ? 'Z-Only ' : ''}{filterConfig.lowPassFreq}Hz LP)
                      </span>
                    )}
                  </h2>
                  <div className={`flex rounded border ${theme.border} p-0.5`}>
                    {['ax', 'ay', 'az'].map((ax) => (
                      <button 
                        key={ax} 
                        onClick={() => setAccelAxis(ax as DataAxis)}
                        className={`px-2 py-0.5 text-xs font-bold rounded ${
                          accelAxis === ax ? `bg-gray-500/20 ${theme.textPrimary}` : theme.textSecondary
                        }`}
                      >
                        {ax.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                   <div className="flex items-center gap-1">
                     <span className={`text-[10px] ${theme.textSecondary}`}>{t.refLines}</span>
                     <select 
                       value={refLineLevel || 0}
                       onChange={(e) => setRefLineLevel(Number(e.target.value) || null)}
                       className={`text-[10px] p-1 rounded border ${theme.border} bg-transparent ${theme.textPrimary}`}
                     >
                       <option value="0">Off</option>
                       <option value="10">±10</option>
                       <option value="15">±15</option>
                     </select>
                   </div>
                  
                  <span className={`text-[10px] ${theme.textSecondary} ml-2`}>{t.yScale}</span>
                  <input 
                    placeholder="Min" 
                    className={`w-12 text-[10px] p-1 rounded border ${theme.border} bg-transparent ${theme.textPrimary}`}
                    value={yMinAccel} onChange={(e) => setYMinAccel(e.target.value)}
                  />
                  <input 
                    placeholder="Max" 
                    className={`w-12 text-[10px] p-1 rounded border ${theme.border} bg-transparent ${theme.textPrimary}`}
                    value={yMaxAccel} onChange={(e) => setYMaxAccel(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex-1 min-h-0">
                <TimeChart 
                  data={displayData} 
                  axis={accelAxis} 
                  color={theme.chartColors[accelAxis]}
                  syncId="timeSync"
                  windowRange={{ start: windowStart, end: windowStart + windowSize }}
                  onChartClick={handleChartClick}
                  globalStats={globalStats}
                  referenceLines={refLineLevel ? [refLineLevel, -refLineLevel] : undefined}
                  yDomain={parseDomain(yMinAccel, yMaxAccel)}
                  gridColor={theme.gridColor}
                  textColor={theme.textColorHex} // Use HEX now
                  brushColor={theme.brushColor}
                />
              </div>
            </div>

            {/* FFT CHART */}
            <div className={`${theme.bgCard} border ${theme.border} rounded-xl p-4 shadow-sm flex flex-col`} style={{ height: chartHeight }}>
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h2 className={`text-sm font-bold ${theme.textSecondary} flex items-center gap-2`}>
                    {t.fft} ({accelAxis.toUpperCase()})
                </h2>
                <span className={`text-xs ${theme.textSecondary}`}>{t.dominant}: {peakFreq?.freq.toFixed(2)}Hz</span>
              </div>
              <div className="flex-1 min-h-0">
                <FFTChart 
                  data={fftData} 
                  color={theme.chartColors[accelAxis]} 
                  gridColor={theme.gridColor}
                  textColor={theme.textColorHex} // Use HEX now
                />
              </div>
            </div>

            {/* KINEMATICS CHART */}
            <div className={`${theme.bgCard} border ${theme.border} rounded-xl p-4 shadow-sm flex flex-col`} style={{ height: chartHeight }}>
              <div className="flex justify-between items-center mb-4 shrink-0">
                <div className="flex items-center gap-4">
                  <h2 className={`text-sm font-bold ${theme.textSecondary} flex items-center gap-2`}>
                    <span className="w-2 h-2 rounded-sm" style={{backgroundColor: theme.chartColors[intAxis]}}></span>
                    {t.kinematics}
                  </h2>
                  <div className={`flex rounded border ${theme.border} p-0.5`}>
                    {['vz', 'sz'].map((ax) => (
                      <button 
                        key={ax} 
                        onClick={() => setIntAxis(ax as DataAxis)}
                        className={`px-2 py-0.5 text-xs font-bold rounded ${
                          intAxis === ax ? `bg-gray-500/20 ${theme.textPrimary}` : theme.textSecondary
                        }`}
                      >
                        {ax.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${theme.textSecondary}`}>{t.yScale}</span>
                  <input 
                    placeholder="Min" 
                    className={`w-12 text-[10px] p-1 rounded border ${theme.border} bg-transparent ${theme.textPrimary}`}
                    value={yMinInt} onChange={(e) => setYMinInt(e.target.value)}
                  />
                  <input 
                    placeholder="Max" 
                    className={`w-12 text-[10px] p-1 rounded border ${theme.border} bg-transparent ${theme.textPrimary}`}
                    value={yMaxInt} onChange={(e) => setYMaxInt(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex-1 min-h-0">
                <TimeChart 
                  data={displayData} 
                  axis={intAxis} 
                  color={theme.chartColors[intAxis]}
                  syncId="timeSync"
                  windowRange={{ start: windowStart, end: windowStart + windowSize }}
                  onChartClick={handleChartClick}
                  yDomain={parseDomain(yMinInt, yMaxInt)}
                  gridColor={theme.gridColor}
                  textColor={theme.textColorHex} // Use HEX now
                  brushColor={theme.brushColor}
                />
              </div>
            </div>

        </div>
      </main>
    </div>
  );
};

export default App;
