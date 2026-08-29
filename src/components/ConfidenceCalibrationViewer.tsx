import React from 'react';
import { Target, CheckCircle2, AlertCircle, Info, Sparkles } from 'lucide-react';
import type { CalibratedConfidenceResult } from '../types';
import { cn } from '../lib/utils';

interface ConfidenceCalibrationViewerProps {
  calibration?: CalibratedConfidenceResult | null;
}

export default function ConfidenceCalibrationViewer({ calibration }: ConfidenceCalibrationViewerProps) {
  if (!calibration) return null;

  const {
    rawEvidenceScore,
    calibratedConfidence,
    historicalSimilarSetupReliability,
    calibrationState,
    calibrationAdjustment,
    sampleSize,
    rationale
  } = calibration;

  return (
    <div className="glass-card p-5 border-blue-500/20 bg-blue-950/10 space-y-4" id="confidence-calibration-viewer">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-400" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Calibrated Confidence & Reliability Curve
          </h4>
        </div>

        <span className={cn(
          "px-2.5 py-0.5 rounded text-[10px] font-bold uppercase",
          calibrationState === 'OPTIMAL'
            ? "bg-green-500/10 text-green-400 border border-green-500/20"
            : calibrationState === 'OVERCALIBRATED'
            ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
            : calibrationState === 'UNDERCALIBRATED'
            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
            : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
        )}>
          {calibrationState}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-black/40 p-3 rounded-lg border border-white/5">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Raw AI Score</p>
          <p className="text-xl font-bold font-mono text-gray-300 mt-0.5">{rawEvidenceScore}%</p>
        </div>

        <div className="bg-black/40 p-3 rounded-lg border border-blue-500/30">
          <p className="text-[10px] text-blue-400 uppercase tracking-wider font-bold">Calibrated Confidence</p>
          <p className="text-xl font-bold font-mono text-blue-400 mt-0.5">{calibratedConfidence}%</p>
        </div>

        <div className="bg-black/40 p-3 rounded-lg border border-white/5">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Historical Similar</p>
          <p className="text-xl font-bold font-mono text-gold mt-0.5">
            {typeof historicalSimilarSetupReliability === 'number' ? `${historicalSimilarSetupReliability}%` : 'N/A'}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 bg-white/[0.03] p-3 rounded-lg border border-white/5 text-xs text-gray-300">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">{rationale}</p>
      </div>
    </div>
  );
}
