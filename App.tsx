
import React, { useState, useEffect, useMemo, useRef } from 'react';
import FileUpload from './components/FileUpload';
import { TimeChart, FFTChart } from './components/Charts';
import { calculateFFT, calculateStats, downsampleData, parseCSV, processVibrationData, calculateLiftBoundaries, calculateIsoStats } from './utils/mathUtils';
import { applyFilters } from './utils/dspUtils';
import { analyzeWithGemini } from './services/geminiService';
import { ProcessedDataPoint, DataAxis, AnalysisStats, AIAnalysisResult, ThemeConfig, FilterConfig, RawDataPoint, ElevatorBoundaries, IsoStats } from './types';

const SAMPLE_RATE = 1600;

// --- TRANSLATIONS ---
const TRANSLATIONS = {
  zh: {
    title: 'MESE ELEVATOR VIBRATION ANALYSIS SYSTEM',
    upload: '上传文件',
    theme: '主题',
    close: '关闭文件',
    globalStats: 'ISO 18738 / GB/T 24474 统计',
    globalStatsNote: '界限定义: t1-t2 (恒速区), t0-t3 (全过程)',
    showBoundaries: '显示界限 (Lim 0-3)',
    windowAnalysis: '窗口分析 (FFT)',
    windowControl: '分析窗口控制',
    viewControl: '视图 / 缩放控制',
    chartHeight: '图表高度',
    aiDiag: 'AI 智能诊断',
    aiSettings: 'API 设置',
    apiKeyPlaceholder: '输入 Google API Key',
    modelPlaceholder: '模型 (默认 gemini-2.5-flash)',
    analyzing: '分析中...',
    kinematics: '运动学',
    vibration: '振动',
    fft: '频谱分析',
    yScale: 'Y轴范围',
    refLines: '参考线',
    dominant: '主频',
    magnitude: '幅值',
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
    targetZ: '仅 Z 轴',
    creator: '制作者：chaizhh@mese-cn.com',
    smecInfo: '请导入SMEC 便携式震动仪数据，该数据可以从钉钉工作台《智能震动测量分析》软件中下载数据',
    viewStart: '视图起点 (s)',
    viewEnd: '视图终点 (s)',
    focusWindow: '聚焦分析窗口',
    resetView: '复位视图',
    resetLayout: '重置布局 (显示FFT)',
    zoomTip: '提示: 在图表上拖拽可放大',
    toggleSidebar: '侧边栏',
    export: '导出/打印',
    exportTitle: '导出选项',
    selectCharts: '选择图表',
    selectAll: '全选',
    print: '打印',
    saveImage: '保存图片',
    cancel: '取消',
    showChart: '显示图表',
    hideChart: '隐藏图表',
    t1t2: '恒速区 (t1-t2)',
    t0t3: '全过程 (t0-t3)'
  },
  en: {
    title: 'MESE ELEVATOR VIBRATION ANALYSIS SYSTEM',
    upload: 'Upload File',
    theme: 'Theme',
    close: 'Close File',
    globalStats: 'ISO 18738 / GB/T 24474 Stats',
    globalStatsNote: 'Boundaries: t1-t2 (Const Vel), t0-t3 (Total)',
    showBoundaries: 'Show Boundaries (Lim 0-3)',
    windowAnalysis: 'Window Analysis (FFT)',
    windowControl: 'Analysis Window',
    viewControl: 'View / Zoom Control',
    chartHeight: 'Chart Height',
    aiDiag: 'AI Diagnostics',
    aiSettings: 'API Settings',
    apiKeyPlaceholder: 'Enter Google API Key',
    modelPlaceholder: 'Model (default gemini-2.5-flash)',
    analyzing: 'Analyzing...',
    kinematics: 'KINEMATICS',
    vibration: 'VIBRATION',
    fft: 'FREQUENCY ANALYSIS',
    yScale: 'Y-SCALE',
    refLines: 'Ref Lines',
    dominant: 'Dominant',
    magnitude: 'Magnitude',
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
    targetZ: 'Z-Axis Only',
    creator: 'Created by: chaizhh@mese-cn.com',
    smecInfo: 'Please import SMEC portable vibrometer data (download from DingTalk Smart Vibration Analysis app).',
    viewStart: 'View Start (s)',
    viewEnd: 'View End (s)',
    focusWindow: 'Focus Window',
    resetView: 'Reset View',
    resetLayout: 'Reset Layout (Show FFT)',
    zoomTip: 'Tip: Drag on chart to zoom',
    toggleSidebar: 'Sidebar',
    export: 'Export/Print',
    exportTitle: 'Export Options',
    selectCharts: 'Select Charts',
    selectAll: 'Select All',
    print: 'Print',
    saveImage: 'Save Image',
    cancel: 'Cancel',
    showChart: 'Show Chart',
    hideChart: 'Hide Chart',
    t1t2: 'Const Vel (t1-t2)',
    t0t3: 'Total (t0-t3)'
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
    name: 'Engineering (Warm)',
    // Pale yellow / Warm tones
    bgApp: 'bg-[#fefce8]', // yellow-50
    bgCard: 'bg-[#fffbeb]', // amber-50/warm white mixture
    bgPanel: 'bg-[#fcfbf7]', 
    textPrimary: 'text-stone-800', // Warm gray/brown
    textSecondary: 'text-stone-500',
    border: 'border-stone-300',
    accent: 'text-amber-600',
    gridColor: '#d6d3d1', // stone-300
    brushColor: '#a8a29e',
    textColorHex: '#57534e', // stone-600
    chartColors: { ax: '#dc2626', ay: '#16a34a', az: '#2563eb', vz: '#7c3aed', sz: '#d97706' }
  },
  {
    id: 'pure-white',
    name: 'Pure White',
    bgApp: 'bg-white',
    bgCard: 'bg-white',
    bgPanel: 'bg-white', 
    textPrimary: 'text-gray-950',
    textSecondary: 'text-gray-500',
    border: 'border-gray-200',
    accent: 'text-blue-600',
    gridColor: '#e5e7eb', // gray-200
    brushColor: '#9ca3af',
    textColorHex: '#374151', // gray-700
    chartColors: { ax: '#ef4444', ay: '#16a34a', az: '#2563eb', vz: '#7c3aed', sz: '#d97706' }
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

  // ISO Calculation State
  const [boundaries, setBoundaries] = useState<ElevatorBoundaries | null>(null);
  const [isoStats, setIsoStats] = useState<IsoStats | null>(null);
  const [showIsoBoundaries, setShowIsoBoundaries] = useState(true);

  // DSP State
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({
    enabled: false,
    highPassFreq: 0,
    lowPassFreq: 30,
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
  
  // View / Zoom State
  const [viewDomain, setViewDomain] = useState<[number, number] | null>(null);
  
  // Chart Height State
  const [chartHeight, setChartHeight] = useState<number>(350);

  // Windowing State (Analysis)
  const [windowStart, setWindowStart] = useState<number>(0);
  const [windowSize, setWindowSize] = useState<number>(4);
  
  // Analysis State
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [refLineLevel, setRefLineLevel] = useState<number | null>(null);

  // AI Settings State
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [userModelName, setUserModelName] = useState<string>('');
  const [showAiSettings, setShowAiSettings] = useState(false);

  // UI Toggle State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSelection, setExportSelection] = useState({ vibration: true, fft: true, kinematics: true });
  const [isFFTVisible, setIsFFTVisible] = useState(true); // Visibility toggle for FFT Chart
  const chartsContainerRef = useRef<HTMLDivElement>(null);

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

    // Calculate ISO Boundaries and Stats
    const bounds = calculateLiftBoundaries(processed);
    setBoundaries(bounds);
    const stats = calculateIsoStats(processed, bounds);
    setIsoStats(stats);

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

  // Determine which global stats to show based on axis
  const currentGlobalStats = useMemo(() => {
    if (!isoStats) return null;
    if (accelAxis === 'ax') return isoStats.x.constVel;
    if (accelAxis === 'ay') return isoStats.y.constVel;
    // For Z, prioritize Const Vel stats for A95, but we might want to toggle views later. 
    // Standard says: Const Vel -> A95, Global -> Max PkPk.
    // Let's pass a merged object for visualization purposes, focusing on Const Vel A95 and Global PkPk if Z
    if (accelAxis === 'az') {
      return {
        ...isoStats.z.constVel, 
        pkPk: isoStats.z.global?.pkPk || isoStats.z.constVel.pkPk, // Use Global for Max PkPk
        maxPkPkPair: isoStats.z.global?.maxPkPkPair // Visual markers for global max
      };
    }
    return null;
  }, [isoStats, accelAxis]);

  // Construct Visual Boundaries for Chart
  const { isoVerticalLines, isoHighlightAreas } = useMemo(() => {
    if (!showIsoBoundaries) return { isoVerticalLines: [], isoHighlightAreas: [] };
    if (!boundaries || !boundaries.isValid) return { isoVerticalLines: [], isoHighlightAreas: [] };
    
    const lines = [
      { x: boundaries.t0, color: '#22c55e', label: 'Lim 0', dash: '3 3' }, // Green Dash
      { x: boundaries.t1, color: '#3b82f6', label: 'Lim 1' }, // Blue Solid
      { x: boundaries.t2, color: '#3b82f6', label: 'Lim 2' }, // Blue Solid
      { x: boundaries.t3, color: '#ef4444', label: 'Lim 3', dash: '3 3' }, // Red Dash
    ];
    
    const areas = [
      { x1: boundaries.t1, x2: boundaries.t2, color: '#a855f7' } // Purple area for const vel
    ];

    return { isoVerticalLines: lines, isoHighlightAreas: areas };
  }, [boundaries, showIsoBoundaries]);

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
    const result = await analyzeWithGemini(
      { ...windowStats, axis: accelAxis }, 
      peakFreq,
      userApiKey,
      userModelName
    );
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
  
  const handleZoom = (left: number, right: number) => {
    if (left === right) return;
    setViewDomain([left, right]);
  };
  
  const resetView = () => {
    setViewDomain(null);
  };
  
  const handleResetLayout = () => {
    setIsFFTVisible(true);
    resetView();
  };

  const focusWindow = () => {
    setViewDomain([windowStart, windowStart + windowSize]);
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
      targetAxes: 'z-only'
    });
  };

  const resetFilters = () => {
    setFilterConfig({
      enabled: false,
      highPassFreq: 0,
      lowPassFreq: 30,
      isStandardWeighting: false,
      targetAxes: 'all'
    });
  };

  // --- TOOLBAR HANDLERS ---
  const maxTime = finalProcessedData ? finalProcessedData[finalProcessedData.length - 1].time : 0;

  const handleZoomX = (direction: 'in' | 'out') => {
    const start = viewDomain ? viewDomain[0] : 0;
    const end = viewDomain ? viewDomain[1] : maxTime;
    const duration = end - start;
    if (duration <= 0) return;

    const factor = 0.25; // 25% zoom
    const change = duration * factor;
    
    let newStart, newEnd;
    if (direction === 'in') {
      newStart = start + change / 2;
      newEnd = end - change / 2;
    } else {
      newStart = start - change / 2;
      newEnd = end + change / 2;
    }
    // Clamping
    if (newStart < 0) newStart = 0;
    if (newEnd > maxTime) newEnd = maxTime;
    if (newEnd <= newStart) return; // Safety

    setViewDomain([newStart, newEnd]);
  };

  const handlePanX = (direction: 'left' | 'right') => {
    const start = viewDomain ? viewDomain[0] : 0;
    const end = viewDomain ? viewDomain[1] : maxTime;
    const duration = end - start;
    const shift = duration * 0.2; // 20% shift
    
    let newStart, newEnd;
    if (direction === 'left') {
       newStart = start - shift;
       newEnd = end - shift;
       if (newStart < 0) {
         newStart = 0;
         newEnd = duration;
       }
    } else {
       newStart = start + shift;
       newEnd = end + shift;
       if (newEnd > maxTime) {
         newEnd = maxTime;
         newStart = maxTime - duration;
       }
    }
    setViewDomain([newStart, newEnd]);
  };
  
  const handleZoomY = (axisType: 'accel' | 'int', direction: 'in' | 'out') => {
    const isAccel = axisType === 'accel';
    const currentMinStr = isAccel ? yMinAccel : yMinInt;
    const currentMaxStr = isAccel ? yMaxAccel : yMaxInt;
    const axisKey = isAccel ? accelAxis : intAxis;
    
    // Determine calculation range
    let minVal: number, maxVal: number;
    
    if (currentMinStr === '' || currentMaxStr === '' || isNaN(Number(currentMinStr)) || isNaN(Number(currentMaxStr))) {
       // Auto mode: Calculate from visible data
       const start = viewDomain ? viewDomain[0] : 0;
       const end = viewDomain ? viewDomain[1] : maxTime;
       const visibleData = displayData.filter(d => d.time >= start && d.time <= end);
       if (visibleData.length === 0) return;
       
       const values = visibleData.map(d => d[axisKey]);
       const vMin = Math.min(...values);
       const vMax = Math.max(...values);
       const vRange = vMax - vMin;
       // Add default padding for auto
       minVal = vMin - vRange * 0.1;
       maxVal = vMax + vRange * 0.1;
       if (vRange === 0) { minVal -= 1; maxVal += 1; }
    } else {
       minVal = Number(currentMinStr);
       maxVal = Number(currentMaxStr);
    }
    
    const range = maxVal - minVal;
    const factor = 0.25;
    const change = range * factor;
    
    let newMin, newMax;
    if (direction === 'in') {
      newMin = minVal + change / 2;
      newMax = maxVal - change / 2;
    } else {
      newMin = minVal - change / 2;
      newMax = maxVal + change / 2;
    }
    
    if (isAccel) {
      setYMinAccel(newMin.toFixed(3));
      setYMaxAccel(newMax.toFixed(3));
    } else {
      setYMinInt(newMin.toFixed(3));
      setYMaxInt(newMax.toFixed(3));
    }
  };

  // Export Handlers
  const handlePrint = () => {
    setShowExportModal(false);
    window.print();
  };

  const handleSaveImage = async () => {
    if (!chartsContainerRef.current || !(window as any).html2canvas) return;
    
    setShowExportModal(false);
    try {
      const canvas = await (window as any).html2canvas(chartsContainerRef.current, {
        backgroundColor: theme.bgApp.includes('950') ? '#030712' : (theme.id === 'engineering' ? '#fefce8' : '#ffffff'),
        scale: 2 
      });
      const data = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = data;
      link.download = `${fileName}_analysis.png`;
      link.click();
    } catch (e) {
      console.error("Image generation failed", e);
      alert("Could not save image.");
    }
  };

  if (!finalProcessedData) {
    return (
      <div className={`h-screen w-screen ${theme.bgApp} flex flex-col relative overflow-hidden`}>
        <div className="absolute top-4 right-4 z-50">
          <button onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} className="text-white bg-gray-800 px-3 py-1 rounded text-sm border border-gray-700">
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
        <FileUpload onDataLoaded={handleFileLoad} />
        <div className="absolute bottom-8 text-center w-full text-gray-500 text-xs px-4">
           <p className="mb-1">{t.dragDrop}</p>
           <p className="mb-3">{t.systemInfo}</p>
           <p className="text-gray-400 opacity-80 max-w-lg mx-auto leading-relaxed">{t.smecInfo}</p>
        </div>
      </div>
    );
  }

  const currentViewStart = viewDomain ? viewDomain[0] : 0;
  const currentViewEnd = viewDomain ? viewDomain[1] : maxTime;

  return (
    <div className={`h-screen w-screen ${theme.bgApp} ${theme.textPrimary} font-sans flex flex-col overflow-hidden`}>
      
      {/* --- HEADER --- */}
      <header className={`flex-none border-b ${theme.border} ${theme.bgCard} backdrop-blur-md z-50 print:hidden`}>
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-1 rounded hover:bg-white/10 ${theme.textSecondary}`}
              title={t.toggleSidebar}
            >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-lg font-mono font-bold tracking-tight">
              MESE <span className={theme.accent}>ELEVATOR</span> VIBRATION ANALYSIS SYSTEM
            </h1>
            <div className="h-4 w-px bg-gray-600"></div>
            <span className={`text-sm ${theme.textSecondary} font-mono`}>{fileName}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
               onClick={() => setShowExportModal(true)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold border ${theme.border} hover:bg-white/10`}
            >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
               {t.export}
            </button>
            <div className="h-4 w-px bg-gray-600"></div>
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

      {/* --- EXPORT MODAL --- */}
      {showExportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden">
          <div className={`${theme.bgPanel} border ${theme.border} rounded-xl shadow-2xl p-6 w-80`}>
            <h3 className="text-lg font-bold mb-4">{t.exportTitle}</h3>
            <div className="space-y-3 mb-6">
               <label className="flex items-center gap-2 cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={exportSelection.vibration} 
                   onChange={e => setExportSelection({...exportSelection, vibration: e.target.checked})}
                 />
                 <span className="text-sm">{t.vibration}</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={exportSelection.fft} 
                   onChange={e => setExportSelection({...exportSelection, fft: e.target.checked})}
                 />
                 <span className="text-sm">{t.fft}</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={exportSelection.kinematics} 
                   onChange={e => setExportSelection({...exportSelection, kinematics: e.target.checked})}
                 />
                 <span className="text-sm">{t.kinematics}</span>
               </label>
            </div>
            <div className="space-y-2">
              <button onClick={handlePrint} className={`w-full py-2 rounded font-bold ${theme.bgCard} border ${theme.border} hover:bg-white/5`}>{t.print}</button>
              <button onClick={handleSaveImage} className={`w-full py-2 rounded font-bold bg-teal-600 hover:bg-teal-500 text-white`}>{t.saveImage}</button>
              <button onClick={() => setShowExportModal(false)} className={`w-full py-2 rounded text-sm ${theme.textSecondary} hover:text-white`}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        {/* --- LEFT SIDEBAR --- */}
        <aside 
          className={`
            ${isSidebarOpen ? 'w-full lg:w-80 translate-x-0' : 'w-0 -translate-x-full hidden'} 
            ${theme.bgPanel} border-r ${theme.border} flex flex-col z-40 shrink-0 transition-all duration-300 print:hidden h-full overflow-y-auto
          `}
        >
          <div className="p-6 space-y-6 pb-20">
            
            {/* 1. Global ISO Stats */}
            <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} shadow-sm`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className={`text-xs font-bold ${theme.textSecondary} uppercase flex items-center gap-2`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${theme.accent.replace('text-', 'bg-')}`}></span>
                  {t.globalStats} ({accelAxis.toUpperCase()})
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className={`text-[10px] ${theme.textSecondary}`}>{t.showBoundaries}</span>
                  <input 
                    type="checkbox" 
                    checked={showIsoBoundaries}
                    onChange={(e) => setShowIsoBoundaries(e.target.checked)}
                    className="rounded border-gray-600 bg-gray-800 focus:ring-0 w-3 h-3"
                  />
                </label>
              </div>
              
              {isoStats && (
                <div className="space-y-4">
                  {/* Const Vel Section (t1-t2) */}
                  <div>
                    <h4 className={`text-[10px] font-bold ${theme.textSecondary} border-b ${theme.border} mb-2`}>
                      {t.t1t2}
                    </h4>
                    {accelAxis === 'az' ? (
                      <div className="space-y-1">
                         <div className="flex justify-between text-xs">
                           <span>{t.a95}</span>
                           <span className="font-mono">{isoStats.z.constVel.a95.toFixed(3)}</span>
                         </div>
                         <div className="flex justify-between text-xs">
                           <span>{t.maxPkPk}</span>
                           <span className="font-mono">{isoStats.z.constVel.pkPk.toFixed(3)}</span>
                         </div>
                      </div>
                    ) : accelAxis === 'ax' ? (
                      <div className="space-y-1">
                         <div className="flex justify-between text-xs">
                           <span>{t.a95}</span>
                           <span className="font-mono">{isoStats.x.constVel.a95.toFixed(3)}</span>
                         </div>
                         <div className="flex justify-between text-xs">
                           <span>{t.maxPkPk}</span>
                           <span className="font-mono">{isoStats.x.constVel.pkPk.toFixed(3)}</span>
                         </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                         <div className="flex justify-between text-xs">
                           <span>{t.a95}</span>
                           <span className="font-mono">{isoStats.y.constVel.a95.toFixed(3)}</span>
                         </div>
                         <div className="flex justify-between text-xs">
                           <span>{t.maxPkPk}</span>
                           <span className="font-mono">{isoStats.y.constVel.pkPk.toFixed(3)}</span>
                         </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Global Section (t0-t3) - Mainly for Z */}
                  {accelAxis === 'az' && isoStats.z.global && (
                    <div>
                      <h4 className={`text-[10px] font-bold ${theme.textSecondary} border-b ${theme.border} mb-2 mt-2`}>
                        {t.t0t3}
                      </h4>
                      <div className="space-y-1">
                         <div className="flex justify-between text-xs font-bold text-yellow-500">
                           <span>{t.maxPkPk}</span>
                           <span className="font-mono">{isoStats.z.global.pkPk.toFixed(3)}</span>
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="text-[10px] text-gray-500 mt-3 opacity-80 italic">
                  {t.globalStatsNote}
              </div>
            </div>

            {/* 2. Window Stats & Controls (FFT) */}
            {windowStats && (
              <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} shadow-sm`}>
                <div className="flex justify-between items-center mb-3">
                  <h3 className={`text-xs font-bold ${theme.textSecondary} uppercase flex items-center gap-2`}>
                    <span className={`w-1.5 h-1.5 rounded-full bg-purple-500`}></span>
                    {t.windowAnalysis}
                  </h3>
                  {/* Re-enable FFT button if hidden */}
                  {!isFFTVisible && (
                    <button 
                      onClick={() => setIsFFTVisible(true)}
                      className="text-[10px] px-2 py-1 rounded bg-purple-600 text-white shadow hover:bg-purple-500 transition-colors font-bold"
                    >
                      {t.showChart}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                   <div className={`flex justify-between items-center border-b ${theme.border} pb-1`}>
                     <span className={`text-xs ${theme.textSecondary}`}>{t.rms}</span>
                     <span className="font-mono text-sm">{windowStats.rms.toFixed(3)}</span>
                   </div>
                   <div className={`flex justify-between items-center border-b ${theme.border} pb-1`}>
                     <span className={`text-xs ${theme.textSecondary}`}>{t.peak}</span>
                     <span className="font-mono text-sm">{windowStats.peakVal.toFixed(3)}</span>
                   </div>
                   <div className={`flex justify-between items-center border-b ${theme.border} pb-1`}>
                     <span className={`text-xs ${theme.textSecondary}`}>{t.dominant}</span>
                     <span className="font-mono text-sm text-yellow-500">{peakFreq?.freq.toFixed(2)} Hz</span>
                   </div>
                   <div className="flex justify-between items-center pt-1">
                     <span className={`text-xs ${theme.textSecondary}`}>{t.magnitude}</span>
                     <span className="font-mono text-sm">{peakFreq?.mag.toFixed(4)}</span>
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

            {/* 4. DSP (Signal Processing) */}
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

            {/* 5. View / Zoom Control */}
             <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} shadow-sm`}>
              <div className="flex justify-between items-center mb-3">
                 <h3 className={`text-xs font-bold ${theme.textSecondary} uppercase flex items-center gap-2`}>
                  <span className={`w-1.5 h-1.5 rounded-full bg-green-500`}></span>
                  {t.viewControl}
                </h3>
              </div>
              <div className="space-y-3">
                 <div className="flex gap-2">
                   <div className="flex-1">
                      <label className="text-[10px] text-gray-500 block mb-1">{t.viewStart}</label>
                      <input 
                        type="number"
                        min="0"
                        max={maxTime}
                        step="0.1"
                        value={currentViewStart.toFixed(2)}
                        onChange={(e) => {
                           const val = Number(e.target.value);
                           setViewDomain([val, Math.max(val + 0.1, currentViewEnd)]);
                        }}
                        className={`w-full text-xs p-1 rounded border ${theme.border} bg-transparent ${theme.textPrimary}`}
                      />
                   </div>
                   <div className="flex-1">
                      <label className="text-[10px] text-gray-500 block mb-1">{t.viewEnd}</label>
                      <input 
                        type="number"
                        min="0"
                        max={maxTime}
                        step="0.1"
                        value={currentViewEnd.toFixed(2)}
                        onChange={(e) => {
                           const val = Number(e.target.value);
                           setViewDomain([Math.min(val - 0.1, currentViewStart), val]);
                        }}
                        className={`w-full text-xs p-1 rounded border ${theme.border} bg-transparent ${theme.textPrimary}`}
                      />
                   </div>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    <button 
                       onClick={focusWindow}
                       className={`flex-1 py-1 px-2 text-[10px] rounded border ${theme.border} hover:bg-white/10`}
                    >
                      {t.focusWindow}
                    </button>
                    <button 
                       onClick={handleResetLayout}
                       className={`flex-1 py-1 px-2 text-[10px] rounded border ${theme.border} hover:bg-white/10`}
                    >
                      {t.resetLayout}
                    </button>
                 </div>
                 <p className="text-[10px] text-gray-500 italic text-center">{t.zoomTip}</p>
              </div>
            </div>

            {/* 6. Chart Height */}
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

             {/* 7. AI Analysis */}
             <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} shadow-sm`}>
              <button
                onClick={handleRunAI}
                disabled={isAnalyzing}
                className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                  isAnalyzing 
                    ? 'bg-gray-800 text-gray-400 cursor-wait'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                }`}
              >
                {isAnalyzing ? t.analyzing : t.aiDiag}
              </button>
              
              <div className="mt-3">
                <button 
                  onClick={() => setShowAiSettings(!showAiSettings)}
                  className={`text-[10px] flex items-center gap-1 ${theme.textSecondary} hover:${theme.textPrimary}`}
                >
                   <span className="text-xs">{showAiSettings ? '▼' : '►'}</span> {t.aiSettings}
                </button>
                
                {showAiSettings && (
                  <div className={`mt-2 p-2 rounded bg-black/20 border ${theme.border} space-y-2`}>
                    <input 
                      type="password"
                      placeholder={t.apiKeyPlaceholder}
                      value={userApiKey}
                      onChange={(e) => setUserApiKey(e.target.value)}
                      className={`w-full text-[10px] p-1.5 rounded border ${theme.border} bg-transparent ${theme.textPrimary} focus:border-${theme.accent.split('-')[1]}`}
                    />
                    <input 
                      type="text"
                      placeholder={t.modelPlaceholder}
                      value={userModelName}
                      onChange={(e) => setUserModelName(e.target.value)}
                      className={`w-full text-[10px] p-1.5 rounded border ${theme.border} bg-transparent ${theme.textPrimary} focus:border-${theme.accent.split('-')[1]}`}
                    />
                  </div>
                )}
              </div>

              {aiResult && (
                <div className={`mt-4 pt-4 border-t ${theme.border}`}>
                   <div className={`text-xs font-bold uppercase mb-2 ${
                     aiResult.status === 'safe' ? 'text-green-500' : 'text-yellow-500'
                   }`}>{aiResult.status}</div>
                   <p className={`text-xs ${theme.textSecondary}`}>{aiResult.summary}</p>
                </div>
              )}
            </div>

            {/* 8. Creator Info */}
            <div className="mt-4 text-[10px] text-center text-gray-500 font-mono">
              {t.creator}
            </div>

          </div>
        </aside>

        {/* --- MAIN CHARTS AREA --- */}
        <div ref={chartsContainerRef} className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto h-full min-w-0 print:w-full print:h-auto print:overflow-visible">
            
            {/* VIBRATION CHART */}
            {exportSelection.vibration && (
            <div className={`${theme.bgCard} border ${theme.border} rounded-xl p-4 shadow-sm flex flex-col shrink-0`} style={{ height: chartHeight }}>
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
                  <div className={`flex rounded border ${theme.border} p-0.5 print:hidden`}>
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

                <div className="flex items-center gap-3 print:hidden">
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
                  
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] ${theme.textSecondary}`}>{t.yScale}</span>
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
                  
                  <div className={`w-px h-4 bg-gray-700 mx-1`}></div>

                  {/* Pan Controls with Hand Icon */}
                  <div className={`flex items-center gap-1 p-0.5 rounded border ${theme.border}`}>
                     <span className={`p-1 ${theme.textSecondary}`} title="Pan Tool">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
                     </span>
                     <button onClick={() => handlePanX('left')} className={`p-1 rounded hover:bg-gray-500/20 ${theme.textPrimary}`} title="Pan Left">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                     </button>
                     <button onClick={() => handlePanX('right')} className={`p-1 rounded hover:bg-gray-500/20 ${theme.textPrimary}`} title="Pan Right">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                     </button>
                  </div>

                  {/* X Zoom */}
                   <div className={`flex items-center gap-1 p-0.5 rounded border ${theme.border}`}>
                     <span className={`text-[10px] font-bold px-1 ${theme.textSecondary}`}>X</span>
                     <button onClick={() => handleZoomX('in')} className={`p-1 rounded hover:bg-gray-500/20 ${theme.textPrimary}`} title="Zoom In X">
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                     </button>
                     <button onClick={() => handleZoomX('out')} className={`p-1 rounded hover:bg-gray-500/20 ${theme.textPrimary}`} title="Zoom Out X">
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                     </button>
                   </div>

                  {/* Y Zoom */}
                   <div className={`flex items-center gap-1 p-0.5 rounded border ${theme.border}`}>
                     <span className={`text-[10px] font-bold px-1 ${theme.textSecondary}`}>Y</span>
                     <button onClick={() => handleZoomY('accel', 'in')} className={`p-1 rounded hover:bg-gray-500/20 ${theme.textPrimary}`} title="Zoom In Y">
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                     </button>
                     <button onClick={() => handleZoomY('accel', 'out')} className={`p-1 rounded hover:bg-gray-500/20 ${theme.textPrimary}`} title="Zoom Out Y">
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                     </button>
                   </div>
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
                  globalStats={currentGlobalStats}
                  referenceLines={refLineLevel ? [refLineLevel, -refLineLevel] : undefined}
                  verticalLines={isoVerticalLines}
                  highlightAreas={isoHighlightAreas}
                  yDomain={parseDomain(yMinAccel, yMaxAccel)}
                  xDomain={viewDomain || undefined}
                  onZoom={handleZoom}
                  gridColor={theme.gridColor}
                  textColor={theme.textColorHex} 
                  brushColor={theme.brushColor}
                />
              </div>
            </div>
            )}

            {/* FFT CHART */}
            {exportSelection.fft && isFFTVisible && (
            <div className={`${theme.bgCard} border ${theme.border} rounded-xl p-4 shadow-sm flex flex-col shrink-0`} style={{ height: chartHeight }}>
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h2 className={`text-sm font-bold ${theme.textSecondary} flex items-center gap-2`}>
                    {t.fft} ({accelAxis.toUpperCase()})
                </h2>
                <div className="flex items-center gap-4">
                  <span className={`text-xs ${theme.textSecondary}`}>{t.dominant}: {peakFreq?.freq.toFixed(2)}Hz</span>
                  <button 
                    onClick={() => setIsFFTVisible(false)}
                    className={`text-[10px] p-1 rounded hover:bg-red-500/20 hover:text-red-500 transition-colors ${theme.textSecondary}`}
                    title={t.hideChart}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <FFTChart 
                  data={fftData} 
                  color={theme.chartColors[accelAxis]} 
                  gridColor={theme.gridColor}
                  textColor={theme.textColorHex} 
                />
              </div>
            </div>
            )}

            {/* KINEMATICS CHART */}
            {exportSelection.kinematics && (
            <div className={`${theme.bgCard} border ${theme.border} rounded-xl p-4 shadow-sm flex flex-col shrink-0`} style={{ height: chartHeight }}>
              <div className="flex justify-between items-center mb-4 shrink-0">
                <div className="flex items-center gap-4">
                  <h2 className={`text-sm font-bold ${theme.textSecondary} flex items-center gap-2`}>
                    <span className="w-2 h-2 rounded-sm" style={{backgroundColor: theme.chartColors[intAxis]}}></span>
                    {t.kinematics}
                  </h2>
                  <div className={`flex rounded border ${theme.border} p-0.5 print:hidden`}>
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

                <div className="flex items-center gap-3 print:hidden">
                  <div className="flex items-center gap-1">
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
                  
                  <div className={`w-px h-4 bg-gray-700 mx-1`}></div>

                  {/* Pan Controls Int */}
                   <div className={`flex items-center gap-1 p-0.5 rounded border ${theme.border}`}>
                     <span className={`p-1 ${theme.textSecondary}`} title="Pan Tool">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
                     </span>
                     <button onClick={() => handlePanX('left')} className={`p-1 rounded hover:bg-gray-500/20 ${theme.textPrimary}`} title="Pan Left">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                     </button>
                     <button onClick={() => handlePanX('right')} className={`p-1 rounded hover:bg-gray-500/20 ${theme.textPrimary}`} title="Pan Right">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                     </button>
                  </div>

                  {/* X Zoom Int */}
                   <div className={`flex items-center gap-1 p-0.5 rounded border ${theme.border}`}>
                     <span className={`text-[10px] font-bold px-1 ${theme.textSecondary}`}>X</span>
                     <button onClick={() => handleZoomX('in')} className={`p-1 rounded hover:bg-gray-500/20 ${theme.textPrimary}`} title="Zoom In X">
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                     </button>
                     <button onClick={() => handleZoomX('out')} className={`p-1 rounded hover:bg-gray-500/20 ${theme.textPrimary}`} title="Zoom Out X">
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                     </button>
                   </div>

                  {/* Y Zoom Int */}
                   <div className={`flex items-center gap-1 p-0.5 rounded border ${theme.border}`}>
                     <span className={`text-[10px] font-bold px-1 ${theme.textSecondary}`}>Y</span>
                     <button onClick={() => handleZoomY('int', 'in')} className={`p-1 rounded hover:bg-gray-500/20 ${theme.textPrimary}`} title="Zoom In Y">
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                     </button>
                     <button onClick={() => handleZoomY('int', 'out')} className={`p-1 rounded hover:bg-gray-500/20 ${theme.textPrimary}`} title="Zoom Out Y">
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                     </button>
                   </div>
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
                  verticalLines={isoVerticalLines}
                  highlightAreas={isoHighlightAreas}
                  yDomain={parseDomain(yMinInt, yMaxInt)}
                  xDomain={viewDomain || undefined}
                  onZoom={handleZoom}
                  gridColor={theme.gridColor}
                  textColor={theme.textColorHex} 
                  brushColor={theme.brushColor}
                />
              </div>
            </div>
            )}

        </div>
      </main>
    </div>
  );
};

export default App;
