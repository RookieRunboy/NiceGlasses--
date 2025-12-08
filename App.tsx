import React, { useState, useEffect, useMemo } from 'react';
import MeasurementWorkspace from './components/MeasurementWorkspace';
import Sidebar from './components/Sidebar';
import { Measurements, ImageDimensions, CalculationResult, HistoryRecord } from './types';

const App: React.FC = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [frameHeightMm, setFrameHeightMm] = useState<number>(0);
  const [imageDims, setImageDims] = useState<ImageDimensions>({ width: 0, height: 0, aspectRatio: 1 });
  
  // History State
  const [history, setHistory] = useState<HistoryRecord[]>(() => {
    const saved = localStorage.getItem('opti_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Initial markers placed somewhat centrally
  const [measurements, setMeasurements] = useState<Measurements>({
    frameTopY: 0.3,
    frameBottomY: 0.5,
    leftPupil: { x: 0.6, y: 0.4 },
    rightPupil: { x: 0.4, y: 0.4 },
    rotation: 0
  });

  // Save history whenever it changes
  useEffect(() => {
    localStorage.setItem('opti_history', JSON.stringify(history));
  }, [history]);

  const handleSaveHistory = (patientName: string, result: CalculationResult) => {
    const newRecord: HistoryRecord = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      patientName: patientName || 'Anonymous',
      leftPupilHeightMm: result.leftPupilHeightMm,
      rightPupilHeightMm: result.rightPupilHeightMm,
      frameHeightMm: frameHeightMm
    };
    setHistory(prev => [newRecord, ...prev]);
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  // Calculation Logic
  const results = useMemo<CalculationResult | null>(() => {
    if (frameHeightMm <= 0 || !imageSrc || imageDims.height === 0) return null;

    // Coordinate System:
    // 1. Image Space: 0-1 x 0-1 (Normalized to image dimensions)
    // 2. Ruler Space: Rotated by `measurements.rotation` around center (0.5, 0.5)
    
    // measurements.frameTopY and frameBottomY are already in Ruler Space Y-coords (0-1 along the rotated axis).
    // measurements.leftPupil/rightPupil are in Image Space.
    
    // We need to transform the Pupil Coordinates into Ruler Space to find their "Height" (Y) relative to the Ruler.
    
    const toRadians = (deg: number) => (deg * Math.PI) / 180;
    const angleRad = toRadians(measurements.rotation);
    const cos = Math.cos(-angleRad); // Counter-rotate point to match axis-aligned ruler
    const sin = Math.sin(-angleRad);
    
    // Center of rotation (normalized)
    const cx = 0.5;
    const cy = 0.5;
    
    // Aspect ratio correction is needed because rotation happens in pixel space (or square space), 
    // but our coordinates are normalized (0-1).
    // Let's project to Pixel Space, Rotate, then Project back? 
    // Or just work in relative space correcting for aspect ratio.
    const aspect = imageDims.aspectRatio;

    const getRotatedY = (p: {x: number, y: number}) => {
        // 1. Vector from center (adjusting X for aspect ratio to make space "square" for rotation)
        const dx = (p.x - cx) * aspect;
        const dy = p.y - cy;
        
        // 2. Rotate vector
        // y' = x*sin + y*cos
        const ry = dx * sin + dy * cos;
        
        // 3. Add center Y back
        return ry + cy;
    };

    const leftPupilY_Rotated = getRotatedY(measurements.leftPupil);
    const rightPupilY_Rotated = getRotatedY(measurements.rightPupil);
    
    // Distance between top and bottom lines (already in Ruler Space)
    const relativeFrameHeight = Math.abs(measurements.frameBottomY - measurements.frameTopY);
    
    if (relativeFrameHeight === 0) return null;
    
    // Ratio: Frame Height (0-1 units) / Real MM
    const unitsPerMm = relativeFrameHeight / frameHeightMm;

    // Pupil Height = Distance from Bottom Line to Pupil Y (in Ruler Space)
    // Note: Y increases downwards. So Bottom Y > Top Y.
    // Height is (BottomY - PupilY)
    
    const leftHeightUnits = measurements.frameBottomY - leftPupilY_Rotated;
    const rightHeightUnits = measurements.frameBottomY - rightPupilY_Rotated;

    return {
      pixelPerMm: (relativeFrameHeight * imageDims.height) / frameHeightMm,
      leftPupilHeightMm: leftHeightUnits / unitsPerMm,
      rightPupilHeightMm: rightHeightUnits / unitsPerMm
    };

  }, [measurements, frameHeightMm, imageDims, imageSrc]);


  const handleImageUpload = (src: string) => {
    setImageSrc(src);
    // Reset measurements to defaults on new image
    setMeasurements({
      frameTopY: 0.3,
      frameBottomY: 0.5,
      leftPupil: { x: 0.6, y: 0.4 },
      rightPupil: { x: 0.4, y: 0.4 },
      rotation: 0
    });
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-slate-50">
      
      {/* Main Workspace Area */}
      <div className="flex-1 relative order-2 md:order-1 h-full">
        {imageSrc ? (
          <MeasurementWorkspace
            imageSrc={imageSrc}
            measurements={measurements}
            onMeasurementsChange={setMeasurements}
            onImageLoad={setImageDims}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-50 p-8 text-center"
               style={{
                   backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)',
                   backgroundSize: '20px 20px'
               }}
          >
             <div className="w-24 h-24 mb-6 rounded-3xl bg-white border border-slate-200 flex items-center justify-center shadow-lg">
                <svg className="w-12 h-12 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
             </div>
             <h2 className="text-2xl font-bold text-slate-800 mb-2">Ready to Measure</h2>
             <p className="max-w-md text-slate-500">
               Upload a photo of the patient wearing glasses. Ensure the frame is clearly visible and the patient is looking straight ahead.
             </p>
          </div>
        )}
      </div>

      {/* Sidebar Controls */}
      <div className="order-1 md:order-2 h-auto md:h-full shrink-0">
         <Sidebar 
            frameHeightMm={frameHeightMm}
            setFrameHeightMm={setFrameHeightMm}
            measurements={measurements}
            setMeasurements={setMeasurements}
            calculation={results}
            onImageUpload={handleImageUpload}
            imageSrc={imageSrc}
            history={history}
            onSaveHistory={handleSaveHistory}
            onDeleteHistory={handleDeleteHistory}
         />
      </div>
      
    </div>
  );
};

export default App;