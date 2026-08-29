import React from 'react';
import { ShieldAlert, CheckCircle, AlertTriangle, Zap, Radio, Activity } from 'lucide-react';
import type { AnomalyReport } from '../types';
import { cn } from '../lib/utils';

interface AnomalyMonitorWidgetProps {
  anomalyReport?: AnomalyReport | null;
  pair: string;
}

export default function AnomalyMonitorWidget({ anomalyReport, pair }: AnomalyMonitorWidgetProps) {
  const isAnomaly = anomalyReport?.isAnomaly || false;
  const severity = anomalyReport?.severity || 'NORMAL';
  const anomalyType = anomalyReport?.type || 'NORMAL';
  const actionRequired = anomalyReport?.actionRequired || 'CONTINUE';

  return (
    <div className={cn(
      "glass-card p-4 border transition-all",
      severity === 'NORMAL'
        ? "border-white/10 bg-white/[0.02]"
        : severity === 'ELEVATED'
        ? "border-yellow-500/30 bg-yellow-950/10"
        : severity === 'HIGH'
        ? "border-orange-500/30 bg-orange-950/15"
        : "border-red-500/40 bg-red-950/20"
    )} id="anomaly-monitor-widget">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {severity === 'NORMAL' ? (
            <CheckCircle className="w-4 h-4 text-green-400" />
          ) : (
            <AlertTriangle className={cn(
              "w-4 h-4",
              severity === 'CRITICAL' ? "text-red-400 animate-pulse" : "text-yellow-400"
            )} />
          )}
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Anomaly & Data Integrity Scanner
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 font-mono">{pair}</span>
          <span className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
            severity === 'NORMAL'
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : severity === 'ELEVATED'
              ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          )}>
            {severity}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
        <div className="bg-black/30 p-2 rounded border border-white/5">
          <span className="text-[10px] text-gray-500 block uppercase">Detected Pattern</span>
          <span className="font-bold text-gray-200 text-[11px] truncate block">
            {anomalyType.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="bg-black/30 p-2 rounded border border-white/5">
          <span className="text-[10px] text-gray-500 block uppercase">Risk Governor Action</span>
          <span className={cn(
            "font-bold text-[11px] truncate block",
            actionRequired === 'CONTINUE' ? "text-green-400" : actionRequired === 'ELEVATE_CONFIRMATION' ? "text-yellow-400" : "text-red-400"
          )}>
            {actionRequired.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {anomalyReport?.evidence && anomalyReport.evidence.length > 0 && (
        <div className="text-[11px] text-gray-300 space-y-1">
          {anomalyReport.evidence.map((ev, i) => (
            <p key={i} className="text-gray-400 leading-snug">• {ev}</p>
          ))}
        </div>
      )}
    </div>
  );
}
