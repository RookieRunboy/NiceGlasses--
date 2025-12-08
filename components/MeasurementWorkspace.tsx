import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Measurements, ImageDimensions } from '../types';
import { RefreshCw, ZoomIn, ZoomOut, ImageOff, RotateCw, MoveHorizontal, MousePointerClick, Settings, Sliders } from 'lucide-react';

interface Props {
  imageSrc: string;
  measurements: Measurements;
  onMeasurementsChange: (m: Measurements) => void;
  onImageLoad: (dims: ImageDimensions) => void;
}

const MeasurementWorkspace: React.FC<Props> = ({
  imageSrc,
  measurements,
  onMeasurementsChange,
  onImageLoad
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Viewport State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingPan, setIsDraggingPan] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loadError, setLoadError] = useState(false);
  const [imageAspect, setImageAspect] = useState(1);

  // Visual Appearance State
  const [showSettings, setShowSettings] = useState(false);
  const [lineThickness, setLineThickness] = useState(2); // pixels
  const [markerSize, setMarkerSize] = useState(16); // pixels

  // UI State for label positions (Visual only, doesn't affect calculation)
  const [labelPositions, setLabelPositions] = useState<{top: number, bottom: number}>({ top: 0.85, bottom: 0.85 });
  const [pupilLabelPos, setPupilLabelPos] = useState<{left: 'top'|'bottom'|'left'|'right', right: 'top'|'bottom'|'left'|'right'}>({
    left: 'top',
    right: 'top'
  });

  // Dragging state for markers
  const [activeDrag, setActiveDrag] = useState<null | 'frameTop' | 'frameBottom' | 'leftPupil' | 'rightPupil' | 'rotator' | 'labelTop' | 'labelBottom'>(null);

  // Reset error state when image source changes
  useEffect(() => {
    setLoadError(false);
  }, [imageSrc]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setLoadError(false);
    const { naturalWidth, naturalHeight } = e.currentTarget;
    const aspect = naturalWidth / naturalHeight;
    setImageAspect(aspect);
    onImageLoad({
      width: naturalWidth,
      height: naturalHeight,
      aspectRatio: aspect
    });
  };

  const handleImageError = () => {
    setLoadError(true);
  };

  // Helper: Get point relative to the unrotated image (0-1)
  const getNormalizedPoint = (clientX: number, clientY: number) => {
    if (!imageRef.current || !containerRef.current) return { x: 0, y: 0 };
    const rect = imageRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return { 
      x: Math.max(0, Math.min(1, x)), 
      y: Math.max(0, Math.min(1, y)) 
    };
  };

  const handleMouseDown = (e: React.MouseEvent, target: 'frameTop' | 'frameBottom' | 'leftPupil' | 'rightPupil' | 'rotator' | 'labelTop' | 'labelBottom') => {
    e.stopPropagation();
    e.preventDefault();
    setActiveDrag(target);
  };

  const togglePupilLabel = (e: React.MouseEvent, eye: 'left' | 'right') => {
    e.stopPropagation();
    setPupilLabelPos(prev => {
      const current = prev[eye];
      const nextMap: Record<string, 'top'|'right'|'bottom'|'left'> = {
        'top': 'right',
        'right': 'bottom',
        'bottom': 'left',
        'left': 'top'
      };
      return { ...prev, [eye]: nextMap[current] };
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (activeDrag) {
      const newMeasurements = { ...measurements };
      
      // Pupils are attached to the IMAGE (Unrotated space)
      if (activeDrag === 'leftPupil' || activeDrag === 'rightPupil') {
        const point = getNormalizedPoint(e.clientX, e.clientY);
        if (activeDrag === 'leftPupil') newMeasurements.leftPupil = point;
        if (activeDrag === 'rightPupil') newMeasurements.rightPupil = point;
        onMeasurementsChange(newMeasurements);
      } 
      // Lines are attached to the RULER (Rotated space)
      else if (activeDrag === 'frameTop' || activeDrag === 'frameBottom') {
         // We need to project mouse movement onto the rotated Y axis
         if (imageRef.current) {
             const rect = imageRef.current.getBoundingClientRect();
             // Convert rotation to radians
             const rad = (measurements.rotation * Math.PI) / 180;
             
             // Mouse movement in screen pixels
             const dx = e.movementX;
             const dy = e.movementY;

             // Project movement onto the rotated Y-axis vector (-sin(a), cos(a))
             const dyRotated = -dx * Math.sin(rad) + dy * Math.cos(rad);
             
             // Convert pixels to percentage (0-1)
             const dPercent = dyRotated / rect.height;

             if (activeDrag === 'frameTop') {
                 newMeasurements.frameTopY = Math.max(0, Math.min(1, measurements.frameTopY + dPercent));
             } else {
                 newMeasurements.frameBottomY = Math.max(0, Math.min(1, measurements.frameBottomY + dPercent));
             }
             onMeasurementsChange(newMeasurements);
         }
      }
      // Dragging the LABELS along the line (X-axis relative to line)
      else if (activeDrag === 'labelTop' || activeDrag === 'labelBottom') {
         const rad = (measurements.rotation * Math.PI) / 180;
         const dx = e.movementX;
         const dy = e.movementY;
         
         // Project movement onto the rotated X-axis vector (cos(a), sin(a))
         const dxRotated = dx * Math.cos(rad) + dy * Math.sin(rad);
         
         // Sensitivity
         const sensitivity = 0.001; 

         setLabelPositions(prev => ({
            ...prev,
            [activeDrag === 'labelTop' ? 'top' : 'bottom']: Math.max(0.1, Math.min(0.9, prev[activeDrag === 'labelTop' ? 'top' : 'bottom'] + (dxRotated * sensitivity)))
         }));
      }
      else if (activeDrag === 'rotator') {
          // Simple drag left/right to rotate
          const sensitivity = 0.5;
          newMeasurements.rotation += e.movementX * sensitivity;
          // Clamp to reasonable values
          newMeasurements.rotation = Math.max(-45, Math.min(45, newMeasurements.rotation));
          onMeasurementsChange(newMeasurements);
      }
      
    } else if (isDraggingPan) {
        setPan({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    }
  }, [activeDrag, isDraggingPan, dragStart, measurements, onMeasurementsChange, getNormalizedPoint]);

  const handleMouseUp = useCallback(() => {
    setActiveDrag(null);
    setIsDraggingPan(false);
  }, []);

  useEffect(() => {
    if (activeDrag || isDraggingPan) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDrag, isDraggingPan, handleMouseMove, handleMouseUp]);

  const handlePanStart = (e: React.MouseEvent) => {
    if (e.button === 0 && !activeDrag) { 
      setIsDraggingPan(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const rotationStyle = {
    transform: `rotate(${measurements.rotation}deg)`,
    transformOrigin: 'center center'
  };

  // Helper to get pupil label classes
  const getPupilLabelStyle = (pos: string) => {
    switch(pos) {
      case 'right': return { left: `calc(50% + ${markerSize/2 + 10}px)`, top: '50%', transform: 'translateY(-50%)' };
      case 'bottom': return { top: `calc(50% + ${markerSize/2 + 10}px)`, left: '50%', transform: 'translateX(-50%)' };
      case 'left': return { right: `calc(50% + ${markerSize/2 + 10}px)`, top: '50%', transform: 'translateY(-50%)' };
      case 'top': default: return { bottom: `calc(50% + ${markerSize/2 + 10}px)`, left: '50%', transform: 'translateX(-50%)' };
    }
  };

  if (loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 p-8 text-center text-slate-500">
        <ImageOff className="w-16 h-16 mb-4 text-slate-300" />
        <h3 className="text-lg font-semibold text-slate-700">Image Failed to Load</h3>
        <p className="max-w-md mt-2 text-sm">
          The browser could not display this image. It might be a format not supported by web browsers (like HEIC).
        </p>
        <p className="mt-4 text-sm font-medium text-indigo-600">
          Please try converting it to JPG or PNG and upload again.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-50 flex items-center justify-center select-none"
         style={{
            backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
            backgroundSize: '20px 20px'
         }}
    >
       {/* Toolbar */}
       <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
           <div className="flex gap-2 bg-white/90 p-2 rounded-lg backdrop-blur-sm border border-slate-200 shadow-sm">
             <button 
                onClick={() => setShowSettings(!showSettings)} 
                className={`p-2 rounded transition-colors ${showSettings ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600 hover:bg-slate-100'}`}
                title="Visual Settings"
             >
                 <Settings size={20}/>
             </button>
             <div className="w-px bg-slate-200 mx-1"></div>
             <button onClick={() => setZoom(z => Math.max(0.5, z - 0.5))} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Zoom Out"><ZoomOut size={20}/></button>
             <span className="text-slate-700 font-medium text-sm flex items-center min-w-[3rem] justify-center">{Math.round(zoom * 100)}%</span>
             <button onClick={() => setZoom(z => Math.min(10, z + 0.5))} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Zoom In"><ZoomIn size={20}/></button>
             <button onClick={() => { setZoom(1); setPan({x:0, y:0}); }} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Reset View"><RefreshCw size={20}/></button>
           </div>
           
           {/* Visual Settings Dropdown */}
           {showSettings && (
               <div className="bg-white/90 p-4 rounded-lg backdrop-blur-sm border border-slate-200 shadow-lg w-64 space-y-4">
                   <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2 border-b border-slate-100 pb-2">
                       <Sliders size={16}/> Visual Settings
                   </div>
                   
                   <div>
                       <div className="flex justify-between text-xs text-slate-500 mb-1">
                           <span>Line Thickness</span>
                           <span>{lineThickness}px</span>
                       </div>
                       <input 
                          type="range" min="1" max="10" step="1"
                          value={lineThickness}
                          onChange={(e) => setLineThickness(parseInt(e.target.value))}
                          className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                       />
                   </div>

                   <div>
                       <div className="flex justify-between text-xs text-slate-500 mb-1">
                           <span>Marker Size</span>
                           <span>{markerSize}px</span>
                       </div>
                       <input 
                          type="range" min="10" max="40" step="2"
                          value={markerSize}
                          onChange={(e) => setMarkerSize(parseInt(e.target.value))}
                          className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                       />
                   </div>
               </div>
           )}
       </div>

      <div 
        ref={containerRef}
        className="relative cursor-move transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
        onMouseDown={handlePanStart}
      >
        <div className="relative shadow-2xl shadow-slate-300 bg-white">
          {/* 1. Base Image Layer (Static Rotation) */}
          <img 
            ref={imageRef}
            src={imageSrc} 
            alt="Measurement Subject" 
            className="max-w-none block pointer-events-none select-none"
            style={{ maxHeight: '80vh', maxWidth: '80vw' }}
            onLoad={handleImageLoad}
            onError={handleImageError}
            draggable={false}
          />

          {/* 2. Pupil Marker Layer (Static Rotation - Fixed to Image Features) */}
          <div className="absolute inset-0 pointer-events-none">
             {/* Right Eye (Image Left) */}
            <div 
              className="absolute group cursor-move pointer-events-auto"
              style={{ left: `${measurements.rightPupil.x * 100}%`, top: `${measurements.rightPupil.y * 100}%` }}
              onMouseDown={(e) => handleMouseDown(e, 'rightPupil')}
            >
              <div 
                  className="absolute flex items-center justify-center"
                  style={{ width: markerSize * 2, height: markerSize * 2, transform: 'translate(-50%, -50%)' }}
              >
                 <div 
                    className="rounded-full border-2 border-yellow-400 bg-yellow-400/20 shadow-[0_0_4px_rgba(0,0,0,0.5)] group-hover:scale-125 transition-transform"
                    style={{ width: markerSize, height: markerSize, borderWidth: Math.max(1, lineThickness/2) }}
                 ></div>
                 <div className="absolute bg-yellow-400/70" style={{ width: markerSize * 2, height: Math.max(1, lineThickness/2) }}></div>
                 <div className="absolute bg-yellow-400/70" style={{ height: markerSize * 2, width: Math.max(1, lineThickness/2) }}></div>
              </div>
              <div 
                className="absolute whitespace-nowrap bg-yellow-600 text-white text-xs px-2 py-0.5 rounded shadow-sm z-10 cursor-pointer hover:bg-yellow-500 flex items-center gap-1"
                style={getPupilLabelStyle(pupilLabelPos.right)}
                onClick={(e) => togglePupilLabel(e, 'right')}
                title="Click to move label"
              >
                  Right Eye (OD) <MousePointerClick size={10} className="opacity-70"/>
              </div>
            </div>

            {/* Left Eye (Image Right) */}
            <div 
              className="absolute group cursor-move pointer-events-auto"
              style={{ left: `${measurements.leftPupil.x * 100}%`, top: `${measurements.leftPupil.y * 100}%` }}
              onMouseDown={(e) => handleMouseDown(e, 'leftPupil')}
            >
               <div 
                  className="absolute flex items-center justify-center"
                  style={{ width: markerSize * 2, height: markerSize * 2, transform: 'translate(-50%, -50%)' }}
              >
                 <div 
                    className="rounded-full border-2 border-green-500 bg-green-500/20 shadow-[0_0_4px_rgba(0,0,0,0.5)] group-hover:scale-125 transition-transform"
                    style={{ width: markerSize, height: markerSize, borderWidth: Math.max(1, lineThickness/2) }}
                 ></div>
                 <div className="absolute bg-green-500/70" style={{ width: markerSize * 2, height: Math.max(1, lineThickness/2) }}></div>
                 <div className="absolute bg-green-500/70" style={{ height: markerSize * 2, width: Math.max(1, lineThickness/2) }}></div>
              </div>
              <div 
                className="absolute whitespace-nowrap bg-green-600 text-white text-xs px-2 py-0.5 rounded shadow-sm z-10 cursor-pointer hover:bg-green-500 flex items-center gap-1"
                style={getPupilLabelStyle(pupilLabelPos.left)}
                onClick={(e) => togglePupilLabel(e, 'left')}
                title="Click to move label"
              >
                  Left Eye (OS) <MousePointerClick size={10} className="opacity-70"/>
              </div>
            </div>
          </div>

          {/* 3. Ruler Layer (Rotatable - Aligns with Glasses) */}
          <div className="absolute inset-0 pointer-events-none" style={{ ...rotationStyle }}>
            
            {/* Center Rotation Handle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-auto cursor-ew-resize"
                 onMouseDown={(e) => handleMouseDown(e, 'rotator')}
            >
                 <div className="w-12 h-12 rounded-full border-2 border-indigo-500/50 bg-indigo-500/10 flex items-center justify-center backdrop-blur-sm">
                    <RotateCw className="text-indigo-600 w-6 h-6" />
                 </div>
            </div>

            {/* Top Frame Line */}
            <div 
              className="absolute w-[200%] -left-[50%] group cursor-ns-resize pointer-events-auto flex flex-col justify-center"
              style={{ top: `${measurements.frameTopY * 100}%`, height: Math.max(24, lineThickness * 3), marginTop: -(Math.max(24, lineThickness * 3)/2) }}
              onMouseDown={(e) => handleMouseDown(e, 'frameTop')}
            >
              <div 
                className="w-full border-cyan-500 border-dashed transition-opacity shadow-[0_1px_2px_rgba(0,0,0,0.3)] opacity-80 group-hover:opacity-100 group-hover:border-cyan-400"
                style={{ borderTopWidth: lineThickness }}
              ></div>
              {/* Draggable Label */}
              <div 
                className="absolute -top-6 bg-cyan-600 text-white text-xs px-2 py-0.5 rounded shadow-sm cursor-ew-resize hover:bg-cyan-500 flex items-center gap-1"
                style={{ left: `${labelPositions.top * 100}%`, transform: 'translateX(-50%)' }}
                onMouseDown={(e) => handleMouseDown(e, 'labelTop')}
                title="Drag to slide label"
              >
                Frame Top <MoveHorizontal size={10} className="opacity-70" />
              </div>
            </div>

            {/* Bottom Frame Line */}
            <div 
              className="absolute w-[200%] -left-[50%] group cursor-ns-resize pointer-events-auto flex flex-col justify-center"
              style={{ top: `${measurements.frameBottomY * 100}%`, height: Math.max(24, lineThickness * 3), marginTop: -(Math.max(24, lineThickness * 3)/2) }}
              onMouseDown={(e) => handleMouseDown(e, 'frameBottom')}
            >
               <div 
                    className="w-full border-cyan-500 border-dashed transition-opacity shadow-[0_1px_2px_rgba(0,0,0,0.3)] opacity-80 group-hover:opacity-100 group-hover:border-cyan-400"
                    style={{ borderTopWidth: lineThickness }}
               ></div>
               {/* Draggable Label */}
               <div 
                className="absolute top-4 bg-cyan-600 text-white text-xs px-2 py-0.5 rounded shadow-sm cursor-ew-resize hover:bg-cyan-500 flex items-center gap-1"
                style={{ left: `${labelPositions.bottom * 100}%`, transform: 'translateX(-50%)' }}
                onMouseDown={(e) => handleMouseDown(e, 'labelBottom')}
                title="Drag to slide label"
               >
                 Frame Bottom <MoveHorizontal size={10} className="opacity-70" />
               </div>
            </div>

          </div>
        </div>
      </div>
      
      <div className="absolute bottom-4 left-4 text-slate-400 text-xs pointer-events-none bg-white/80 p-2 rounded backdrop-blur">
         Drag lines to adjust. Drag labels to move them. Click eye labels to rotate position.
      </div>
    </div>
  );
};

export default MeasurementWorkspace;