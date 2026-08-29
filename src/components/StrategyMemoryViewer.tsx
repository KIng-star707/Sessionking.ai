import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Database, TrendingUp, AlertTriangle, ShieldCheck, RefreshCw, Filter, Sparkles } from 'lucide-react';
import type { StrategyPerformanceRecord } from '../types';
import { strategyPerformanceMemory, MIN_SAMPLE_SIZE_THRESHOLD } from '../services/strategyPerformanceMemory';
import { cn } from '../lib/utils';

export default function StrategyMemoryViewer() {
  const [records, setRecords] = useState<StrategyPerformanceRecord[]>([]);
  const [selectedPair, setSelectedPair] = useState<string>('All');
  const [selectedRegime, setSelectedRegime] = useState<string>('All');

  const loadData = () => {
    strategyPerformanceMemory.seedBaselineMemoryIfEmpty();
    setRecords(strategyPerformanceMemory.getAllRecords());
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRecords = records.filter(r => {
    const pairMatch = selectedPair === 'All' || r.pair === selectedPair;
    const regimeMatch = selectedRegime === 'All' || r.regime === selectedRegime;
    return pairMatch && regimeMatch;
  });

  const totalEvaluatedTrades = records.reduce((sum, r) => sum + r.totalTrades, 0);
  const healthyCount = records.filter(r => r.decayState === 'HEALTHY').length;
  const decayCount = records.filter(r => r.decayState === 'MODERATE_DECAY' || r.decayState === 'SEVERE_DECAY').length;

  return (
    <div className="space-y-6" id="strategy-memory-viewer">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 border-white/10">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Total Logged Setups</p>
          <p className="text-2xl font-bold font-mono text-white mt-1">{records.length}</p>
          <p className="text-[10px] text-gray-500 mt-1">{totalEvaluatedTrades} individual trade outcomes</p>
        </div>

        <div className="glass-card p-5 border-white/10">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Healthy Strategies</p>
          <p className="text-2xl font-bold font-mono text-green-400 mt-1">{healthyCount}</p>
          <p className="text-[10px] text-green-500/80 mt-1">Stable expectancy confirmed</p>
        </div>

        <div className="glass-card p-5 border-white/10">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Decay Flagged</p>
          <p className="text-2xl font-bold font-mono text-yellow-400 mt-1">{decayCount}</p>
          <p className="text-[10px] text-yellow-500/80 mt-1">Adaptive weights dampened</p>
        </div>

        <div className="glass-card p-5 border-white/10">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Sample Size Threshold</p>
          <p className="text-2xl font-bold font-mono text-blue-400 mt-1">N ≥ {MIN_SAMPLE_SIZE_THRESHOLD}</p>
          <p className="text-[10px] text-blue-400/80 mt-1">Statistical significance gate</p>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="glass-card p-4 border-white/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
            className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="All">All Pairs</option>
            <option value="EUR/USD">EUR/USD</option>
            <option value="GBP/USD">GBP/USD</option>
            <option value="USD/JPY">USD/JPY</option>
            <option value="XAU/USD">XAU/USD</option>
          </select>

          <select
            value={selectedRegime}
            onChange={(e) => setSelectedRegime(e.target.value)}
            className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="All">All Regimes</option>
            <option value="TRENDING_BULLISH">Trending Bullish</option>
            <option value="TRENDING_BEARISH">Trending Bearish</option>
            <option value="RANGING_CONSOLIDATION">Ranging Consolidation</option>
            <option value="HIGH_VOLATILITY">High Volatility</option>
          </select>
        </div>

        <button
          onClick={loadData}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Memory Cache
        </button>
      </div>

      {/* Table of Records */}
      <div className="glass-card p-6 border-white/10">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-gold" /> Segmented Strategy Performance Records
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-white/10 text-gray-400">
                <th className="py-3 px-3">Strategy</th>
                <th className="py-3 px-3">Pair / Session</th>
                <th className="py-3 px-3">Regime</th>
                <th className="py-3 px-3">Sample (N)</th>
                <th className="py-3 px-3">Win Rate</th>
                <th className="py-3 px-3">Avg Exp (R)</th>
                <th className="py-3 px-3">Profit Factor</th>
                <th className="py-3 px-3">Decay Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {filteredRecords.map((r, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3 font-bold text-white">{r.strategyKey}</td>
                  <td className="py-3 px-3">{r.pair} ({r.session})</td>
                  <td className="py-3 px-3 text-gray-400 text-[11px]">{r.regime}</td>
                  <td className="py-3 px-3">{r.totalTrades}</td>
                  <td className="py-3 px-3">
                    <span className={r.winRate >= 55 ? "text-green-400 font-bold" : "text-yellow-400 font-bold"}>
                      {r.winRate}%
                    </span>
                  </td>
                  <td className="py-3 px-3">{r.avgRPerTrade > 0 ? `+${r.avgRPerTrade}R` : `${r.avgRPerTrade}R`}</td>
                  <td className="py-3 px-3 text-white font-bold">{r.profitFactor.toFixed(2)}</td>
                  <td className="py-3 px-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                      r.decayState === 'HEALTHY'
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : r.decayState === 'MODERATE_DECAY'
                        ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                        : r.decayState === 'SEVERE_DECAY'
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                    )}>
                      {r.decayState}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
