import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Activity, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Cpu, 
  CheckCircle2, 
  Database, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  Wrench,
  Layers,
  Terminal,
  RotateCcw
} from "lucide-react";
import { systemHealth, SystemHealthState, SubsystemStatus } from "../services/systemHealthService";
import { cn } from "../lib/utils";

interface SystemHealthWidgetProps {
  compact?: boolean;
  showTitle?: boolean;
}

export default function SystemHealthWidget({ compact = false, showTitle = true }: SystemHealthWidgetProps) {
  const [healthState, setHealthState] = useState<SystemHealthState>(systemHealth.getState());
  const [isScanning, setIsScanning] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    const unsubscribe = systemHealth.subscribe((state) => {
      setHealthState(state);
    });
    return () => unsubscribe();
  }, []);

  const handleManualScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      systemHealth.runDiagnosticScan();
      setIsScanning(false);
    }, 600);
  };

  const handleSelfHeal = (subsystemId?: string) => {
    setIsScanning(true);
    setTimeout(() => {
      systemHealth.triggerAutoRecovery(subsystemId);
      setIsScanning(false);
    }, 500);
  };

  const isAllOperational = healthState.overallStatus === 'OPERATIONAL';

  return (
    <div className={cn(
      "glass-card border border-white/10 rounded-2xl relative overflow-hidden transition-all shadow-xl",
      compact ? "p-3.5" : "p-5"
    )}>
      {/* Background Glow */}
      <div className={cn(
        "absolute -right-20 -top-20 w-60 h-60 rounded-full blur-3xl pointer-events-none transition-colors",
        isAllOperational ? "bg-emerald-500/5" : "bg-amber-500/10"
      )} />

      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "p-2 rounded-xl border flex items-center justify-center transition-colors",
            isAllOperational 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
              : "bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse"
          )}>
            <Cpu className="w-4 h-4" />
          </div>
          
          <div>
            {showTitle && (
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-1.5 font-mono">
                  SESSIONKING System Health
                </h3>
                <span className={cn(
                  "text-[9px] px-2 py-0.5 rounded-full font-mono font-bold border uppercase tracking-wider",
                  isAllOperational 
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" 
                    : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                )}>
                  {healthState.overallStatus}
                </span>
              </div>
            )}
            <p className="text-[10px] text-gray-400 font-mono">
              8 Core Subsystems • Self-Healing Diagnostic Scan Active
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSelfHeal()}
            className="p-1.5 px-2.5 bg-black/60 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all text-[10px] font-mono flex items-center gap-1"
            title="Trigger System Self-Recovery"
          >
            <RotateCcw className="w-3 h-3 text-gold" />
            <span className="hidden sm:inline">Self-Heal</span>
          </button>

          <button
            onClick={handleManualScan}
            disabled={isScanning}
            className="p-1.5 px-2.5 bg-gold/15 hover:bg-gold/25 text-gold border border-gold/30 rounded-xl transition-all text-[10px] font-mono flex items-center gap-1 disabled:opacity-50"
            title="Run Diagnostic Scan"
          >
            <RefreshCw className={cn("w-3 h-3", isScanning && "animate-spin")} />
            <span className="hidden sm:inline">Diagnostic Scan</span>
          </button>

          {compact && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-gray-400 hover:text-white"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Subsystem Grid */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-white/10 space-y-3 relative z-10"
          >
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-gray-400 block">Total Diagnostic Scans</span>
                <span className="text-white font-bold text-xs">{healthState.totalDiagnosticScans}</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-gray-400 block">Auto-Recoveries</span>
                <span className="text-emerald-400 font-bold text-xs">{healthState.recoveredIncidentsCount} Incidents</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-gray-400 block">Avg Response Latency</span>
                <span className="text-gold font-bold text-xs">
                  {Math.round(healthState.subsystems.reduce((acc, s) => acc + s.latencyMs, 0) / healthState.subsystems.length)}ms
                </span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-gray-400 block">Active Alerts</span>
                <span className={cn(
                  "font-bold text-xs",
                  healthState.activeAlerts.length > 0 ? "text-amber-400" : "text-gray-400"
                )}>
                  {healthState.activeAlerts.length === 0 ? "None (Clear)" : `${healthState.activeAlerts.length} Degraded`}
                </span>
              </div>
            </div>

            {/* Subsystems List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              {healthState.subsystems.map((sub) => {
                const isOp = sub.status === 'OPERATIONAL';
                const isHealed = sub.status === 'HEALED';

                return (
                  <div
                    key={sub.id}
                    className="bg-black/50 border border-white/5 hover:border-white/10 p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        isOp ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : isHealed ? "bg-blue-400 shadow-[0_0_8px_#60a5fa]" : "bg-amber-400 shadow-[0_0_8px_#fbbf24]"
                      )} />
                      <div className="truncate">
                        <span className="text-xs font-mono font-bold text-white block truncate">
                          {sub.name}
                        </span>
                        <span className="text-[9px] text-gray-400 font-mono block truncate">
                          {sub.details}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                      <span className="text-gray-400">{sub.latencyMs}ms</span>
                      <button
                        onClick={() => handleSelfHeal(sub.id)}
                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                        title="Reset/Re-verify subsystem"
                      >
                        <Wrench className="w-3 h-3 text-gold/70" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
