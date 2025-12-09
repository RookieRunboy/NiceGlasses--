
export interface Point {
  x: number;
  y: number;
}

export interface Measurements {
  frameTopY: number;    // 0 to 1 relative to image height
  frameBottomY: number; // 0 to 1 relative to image height
  leftPupil: Point;     // 0 to 1 relative to image
  rightPupil: Point;    // 0 to 1 relative to image
  rotation: number;     // Degrees, to align with tilted head
}

export interface CalculationResult {
  pixelPerMm: number;
  leftPupilHeightMm: number;
  rightPupilHeightMm: number;
  pupilDistanceMm: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

export interface HistoryRecord {
  id: string;
  timestamp: number;
  patientName: string;
  leftPupilHeightMm: number;
  rightPupilHeightMm: number;
  frameHeightMm: number;
  pupilDistanceMm: number;
}
