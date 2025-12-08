import React, { useRef, useState } from 'react';
import { Upload, Sparkles, Ruler, Info, RotateCw, Save, History, Trash2, Calendar, User } from 'lucide-react';
import { Measurements, CalculationResult, HistoryRecord } from '../types';
import { detectLandmarks } from '../services/geminiService';

interface Props {
  frameHeightMm: number;
  setFrameHeightMm: (h: number) => void;
  measurements: Measurements;
  setMeasurements: (m: Measurements) => void;
  calculation: CalculationResult | null;
  onImageUpload: (src: string) => void;
  imageSrc: string | null;
  history: HistoryRecord[];
  onSaveHistory: (name: string, result: CalculationResult) => void;
  onDeleteHistory: (id: string) => void;
}

const Sidebar: React.FC<Props> = ({
  frameHeightMm,
  setFrameHeightMm,
  measurements,
  setMeasurements,
  calculation,
  onImageUpload,
  imageSrc,
  history,
  onSaveHistory,
  onDeleteHistory
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'measure' | 'history'>('measure');
  const [patientName, setPatientName] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        alert('Unsupported file format. Please upload a JPG, PNG, or WebP image. (iPhone HEIC photos must be converted first)');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageUpload(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const runAutoDetect = async () => {
    if (!imageSrc) return;
    setIsAnalyzing(true);
    try {
      const result = await detectLandmarks(imageSrc);
      if (result) {
        setMeasurements({ ...measurements, ...result });
      } else {
          alert("Could not detect features automatically. Please adjust manually.");
      }
    } catch (e) {
      console.error(e);
      alert("Error during AI analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveClick = () => {
    if (calculation) {
        onSaveHistory(patientName, calculation);
        setPatientName('');
        alert("Result saved to history!");
    }
  };

  const formatDate = (ts: number) => {
      return new Date(ts).toLocaleString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
  };

  return (
    <div className="w-full md:w-96 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-xl z-10">
      <div className="p-6 border-b border-slate-100 shrink-0">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
             <Ruler className="text-white w-5 h-5" />
          </div>
          OptiMeasure AI
        </h1>
        <p className="text-slate-500 text-sm mt-1">Professional Pupil Height Tool</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 shrink-0">
          <button 
            onClick={() => setActiveTab('measure')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'measure' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
              <Ruler size={16} /> Measure
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'history' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
              <History size={16} /> History
          </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        
        {activeTab === 'measure' && (
            <div className="p-6 space-y-8">
                {/* Step 1: Upload */}
                <section>
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    Upload Photo
                </h2>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-4 bg-white border-2 border-dashed border-indigo-200 rounded-xl text-indigo-600 font-medium hover:bg-indigo-50 hover:border-indigo-400 transition-colors flex items-center justify-center gap-2"
                >
                    <Upload size={18} />
                    {imageSrc ? "Change Photo" : "Select Photo"}
                </button>
                <p className="text-xs text-slate-400 mt-2 text-center">
                    Supports JPG, PNG, WebP. <br/>(HEIC/Live Photos not supported)
                </p>
                </section>

                {/* Step 2: Reference */}
                <section className={!imageSrc ? 'opacity-50 pointer-events-none' : ''}>
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    Lens/Frame Height
                </h2>
                <div className="space-y-3">
                    <label className="block text-sm text-slate-600">
                        Enter the measured height of the lens or frame in millimeters. This is the reference for all calculations.
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={frameHeightMm || ''}
                            onChange={(e) => setFrameHeightMm(parseFloat(e.target.value) || 0)}
                            placeholder="e.g. 35"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        />
                        <span className="absolute right-3 top-2 text-slate-400 font-medium">mm</span>
                    </div>
                </div>
                </section>

                {/* Step 3: Adjustments */}
                <section className={!imageSrc ? 'opacity-50 pointer-events-none' : ''}>
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                    Align & Measure
                </h2>
                
                <div className="space-y-4">
                    <button
                        onClick={runAutoDetect}
                        disabled={isAnalyzing}
                        className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg font-medium shadow-md shadow-indigo-200 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {isAnalyzing ? (
                            <span className="animate-pulse">Analyzing...</span>
                        ) : (
                            <>
                            <Sparkles size={16} /> Auto-Detect with Gemini
                            </>
                        )}
                    </button>
                    
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <label className="text-xs font-semibold text-slate-500 mb-2 block flex items-center gap-1">
                        <RotateCw size={12}/> LINE ROTATION
                        </label>
                        <input 
                            type="range" 
                            min="-45" 
                            max="45" 
                            step="0.1"
                            value={measurements.rotation}
                            onChange={(e) => setMeasurements({...measurements, rotation: parseFloat(e.target.value)})}
                            className="w-full accent-indigo-600"
                        />
                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>-45°</span>
                            <span className="text-indigo-600 font-bold">{measurements.rotation.toFixed(1)}°</span>
                            <span>+45°</span>
                        </div>
                    </div>
                    
                    <div className="text-xs text-slate-500 bg-blue-50 text-blue-700 p-3 rounded-md flex items-start gap-2">
                        <Info className="shrink-0 w-4 h-4 mt-0.5" />
                        <p>Drag the <strong>cyan lines</strong> to the top and bottom of the lens. Use the center circle to rotate lines. Drag crosshairs to pupils.</p>
                    </div>
                </div>
                </section>
            </div>
        )}

        {activeTab === 'history' && (
            <div className="p-4 space-y-4">
                 {history.length === 0 ? (
                     <div className="text-center py-10 text-slate-400">
                         <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                         <p className="text-sm">No measurement history yet.</p>
                     </div>
                 ) : (
                     history.map(record => (
                         <div key={record.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative group">
                             <div className="flex justify-between items-start mb-2">
                                 <div>
                                     <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                         <User size={14} className="text-indigo-500"/>
                                         {record.patientName}
                                     </h3>
                                     <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                                         <Calendar size={12}/> {formatDate(record.timestamp)}
                                     </p>
                                 </div>
                                 <button 
                                    onClick={() => onDeleteHistory(record.id)}
                                    className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                                 >
                                     <Trash2 size={16} />
                                 </button>
                             </div>
                             <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                                 <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                     <span className="text-xs text-slate-400 block">Right (OD)</span>
                                     <span className="font-bold text-slate-700">{record.rightPupilHeightMm.toFixed(1)} mm</span>
                                 </div>
                                 <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                     <span className="text-xs text-slate-400 block">Left (OS)</span>
                                     <span className="font-bold text-slate-700">{record.leftPupilHeightMm.toFixed(1)} mm</span>
                                 </div>
                             </div>
                             <div className="text-[10px] text-slate-400 mt-2 text-right">
                                 Frame Ref: {record.frameHeightMm}mm
                             </div>
                         </div>
                     ))
                 )}
            </div>
        )}

      </div>

      {/* Footer: Current Results (Only in Measure Tab) */}
      {activeTab === 'measure' && (
        <div className="bg-slate-900 p-6 text-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] shrink-0">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Results</h3>
            {calculation && frameHeightMm > 0 ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                            <div className="text-slate-400 text-xs mb-1">Right Eye (OD)</div>
                            <div className="text-2xl font-bold text-yellow-400">{calculation.rightPupilHeightMm.toFixed(1)} <span className="text-sm text-slate-500">mm</span></div>
                        </div>
                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                            <div className="text-slate-400 text-xs mb-1">Left Eye (OS)</div>
                            <div className="text-2xl font-bold text-green-400">{calculation.leftPupilHeightMm.toFixed(1)} <span className="text-sm text-slate-500">mm</span></div>
                        </div>
                    </div>
                    
                    {/* Save Section */}
                    <div className="pt-4 border-t border-slate-700/50 flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Patient Name / Ref"
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-white text-sm rounded px-3 py-2 flex-1 outline-none focus:border-indigo-500 placeholder:text-slate-600"
                        />
                        <button 
                            onClick={handleSaveClick}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded transition-colors"
                            title="Save Record"
                        >
                            <Save size={18} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="text-center py-4 text-slate-500 text-sm">
                    {imageSrc ? "Enter frame height to view results." : "Upload an image to start."}
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;