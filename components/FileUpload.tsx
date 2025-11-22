import React, { useRef } from 'react';
import { parseCSV, processVibrationData } from '../utils/mathUtils';
import { ProcessedDataPoint } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: ProcessedDataPoint[], fileName: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const text = await file.text();
    try {
      const raw = parseCSV(text, 1600);
      const processed = processVibrationData(raw, 1600);
      onDataLoaded(processed, file.name);
    } catch (e) {
      alert("Error parsing CSV. Ensure columns 'ax', 'ay', 'az' exist.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-[80vh]">
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-teal-600 to-blue-600 rounded-lg blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative px-8 py-16 bg-gray-900 ring-1 ring-gray-800 rounded-lg leading-none flex flex-col items-center justify-center space-y-4"
        >
          <svg className="w-16 h-16 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-xl text-gray-100 font-bold">Upload Vibration Data</span>
          <span className="text-sm text-gray-400">Supports .csv (ax, ay, az)</span>
        </button>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        accept=".csv"
        className="hidden"
      />
      
      <div className="mt-8 max-w-md text-center text-gray-500 text-sm">
        <p>Drag & Drop or Click to Upload.</p>
        <p className="mt-2">The system will automatically calculate Velocity (Vz) and Displacement (Sz) via integration.</p>
      </div>
    </div>
  );
};

export default FileUpload;