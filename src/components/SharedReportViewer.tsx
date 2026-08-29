import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import { Brain, Target, TrendingUp, TrendingDown, AlignLeft, ShieldAlert, RefreshCw, BarChart2, Activity, ChevronLeft, Calendar } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { cn } from "../lib/utils";
import LiveAnalysisChart from "./LiveAnalysisChart";
import FundamentalAnalysisChart from "./FundamentalAnalysisChart";

interface SharedReportViewerProps {
   onClose: () => void;
}

export default function SharedReportViewer({ onClose }: SharedReportViewerProps) {
    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
        const fetchReport = async () => {
            const params = new URLSearchParams(window.location.search);
            const id = params.get("share");
            
            if (!id) {
                setError("No share token provided.");
                setLoading(false);
                return;
            }
            
            try {
                const docRef = doc(db, "sharedAnalyses", id);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    setReportData(docSnap.data());
                } else {
                    setError("This intelligence report has expired or does not exist.");
                }
            } catch(e) {
                console.error(e);
                setError("Error retrieving report. It may have been purged or inaccessible.");
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen pt-24 px-6 flex items-center justify-center flex-col">
                 
                 <span className="text-gold font-bold tracking-widest uppercase text-sm">Decoding Immutable Ledger...</span>
            </div>
        );
    }

    if (error || !reportData) {
        return (
            <div className="min-h-screen pt-24 px-6 flex items-center justify-center flex-col">
                <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-xl font-bold text-white uppercase tracking-widest mb-2">Access Denied</h2>
                <p className="text-gray-400 mb-8">{error}</p>
                <button onClick={onClose} className="px-6 py-2 bg-gold text-black font-bold uppercase tracking-widest rounded transition-colors hover:bg-yellow-500">Return to Terminal</button>
            </div>
        );
    }
    
    const { report, pair, type, createdBy, createdAt } = reportData;
    const isChart = type === "chart_analysis";

    const renderMarketMatrix = () => (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-5 relative overflow-hidden shadow-lg">
                <h3 className="text-xs font-bold text-gold uppercase tracking-widest flex items-center gap-2">
                <BarChart2 className="w-4 h-4" /> Market Matrix
                </h3>
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-gray-400 text-sm">Market Bias</span>
                <span className={cn(
                    "px-3 py-1 text-xs font-bold uppercase rounded-md flex items-center gap-1 shadow-inner",
                    report.bias === "Bullish" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                    report.bias === "Bearish" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                )}>
                    {report.bias === "Bullish" ? <TrendingUp className="w-3 h-3"/> : report.bias === "Bearish" ? <TrendingDown className="w-3 h-3"/> : <AlignLeft className="w-3 h-3"/>}
                    {report.bias}
                </span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-gray-400 text-sm">Trend Strength</span>
                <span className="text-white text-sm font-semibold">{report.trendStrength}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-gray-400 text-sm">Condition</span>
                <span className="text-white text-sm font-semibold">{report.marketCondition}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-gray-400 text-sm">Smart Money Flow</span>
                <span className={cn("text-sm font-semibold flex items-center gap-1", report.smartMoneyFlow === "Bullish" ? "text-green-400" : report.smartMoneyFlow === "Bearish" ? "text-red-400" : "text-white")}>
                    {report.smartMoneyFlow}
                </span>
                </div>
                <div className="pt-2">
                <span className="text-gray-400 text-xs uppercase mb-2 flex justify-between tracking-widest font-bold">
                    <span>AI Confidence Score</span>
                    <span className="text-gold font-mono">{report.confidenceScore}%</span>
                </span>
                <div className="w-full bg-black/80 rounded-full h-3 outline outline-1 outline-white/10 overflow-hidden relative">
                    <motion.div 
                    className={cn("h-3 rounded-full relative z-10 shadow-[0_0_15px_currentColor]", report.confidenceScore > 75 ? "bg-green-500" : report.confidenceScore > 50 ? "bg-gold" : "bg-red-500")} 
                    initial={{ width: 0 }} 
                    animate={{ width: `${report.confidenceScore}%` }} 
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                </div>
                </div>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-5 shadow-lg relative overflow-hidden">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4" /> Technical Profile
                </h3>
                <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/50 p-3 rounded-lg border border-white/5 relative overflow-hidden group hover:border-white/20 transition-colors">
                    <span className="block text-[10px] text-gray-400 uppercase tracking-wider mb-1">RSI Status</span>
                    <span className={cn("text-sm font-bold font-mono tracking-tight", report.rsiStatus === "Overbought" ? "text-red-400" : report.rsiStatus === "Oversold" ? "text-green-400" : "text-white")}>{report.rsiStatus}</span>
                </div>
                <div className="bg-black/50 p-3 rounded-lg border border-white/5 relative overflow-hidden group hover:border-white/20 transition-colors">
                    <span className="block text-[10px] text-gray-400 uppercase tracking-wider mb-1">MACD</span>
                    <span className="text-sm font-bold text-white font-mono tracking-tight">{report.macdStatus}</span>
                </div>
                <div className="bg-black/50 p-3 rounded-lg border border-white/5 relative overflow-hidden group hover:border-white/20 transition-colors">
                    <span className="block text-[10px] text-gray-400 uppercase tracking-wider mb-1">EMA Align</span>
                    <span className={cn("text-sm font-bold font-mono tracking-tight", report.emaAlignment === "Bullish" ? "text-green-400" : report.emaAlignment === "Bearish" ? "text-red-400" : "text-white")}>{report.emaAlignment}</span>
                </div>
                <div className="bg-black/50 p-3 rounded-lg border border-white/5 relative overflow-hidden group hover:border-white/20 transition-colors">
                    <span className="block text-[10px] text-gray-400 uppercase tracking-wider mb-1">Volatility</span>
                    <span className={cn("text-sm font-bold font-mono tracking-tight", report.volatility === "High" ? "text-red-400" : report.volatility === "Medium" ? "text-gold" : "text-green-400")}>{report.volatility}</span>
                </div>
                </div>
            </div>
         </div>
    );

    return (
        <div className="min-h-screen pt-24 px-6 md:px-12 max-w-6xl mx-auto pb-24">
             <button onClick={onClose} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 font-bold text-sm tracking-widest uppercase">
                 <ChevronLeft className="w-4 h-4" /> Back to Application
             </button>

             <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-white/10 gap-4">
                 <div>
                     <div className="flex items-center gap-3 mb-2">
                         
                         <span className="font-bold tracking-widest uppercase text-sm">PROVENANCE RECORD</span>
                     </div>
                     <h1 className="text-3xl font-bold text-white tracking-widest uppercase">
                        {pair} {isChart ? "Chart Print" : "Market Diagnostic"}
                     </h1>
                 </div>
                 <div className="text-right text-gray-400 font-mono text-xs space-y-1">
                     <p className="flex items-center justify-end gap-2"><Calendar className="w-3 h-3" /> {createdAt ? new Date(createdAt.seconds * 1000).toLocaleString() : 'Recent'}</p>
                     <p>AUTHORIZED BY: {createdBy}</p>
                 </div>
             </div>

             <div className="space-y-6">
                
                {report.highReasoning && (
                    <div className="p-6 bg-gradient-to-r from-deep-blue/30 to-black/20 border border-blue-500/20 rounded-2xl relative overflow-hidden shadow-[0_0_30px_rgba(0,31,63,0.3)] my-6">
                        <div className="flex gap-4 relative z-10">
                            <Brain className="w-6 h-6 text-blue-400 flex-shrink-0" />
                            <div>
                                <h4 className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-3">INSTITUTIONAL REASONING</h4>
                                <p className="text-sm text-gray-300 leading-relaxed">
                                {report.highReasoning}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                
                {renderMarketMatrix()}
                
                {/* Scenarios */}
                <div className="glass-card p-6 rounded-2xl border border-white/10 shadow-lg mb-6">
                    <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                        <Target className="w-4 h-4" /> Structured Scenarios
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-5 bg-gradient-to-b from-green-500/10 to-transparent border-t-2 border-green-500 rounded-b-xl shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-5"><TrendingUp className="w-16 h-16"/></div>
                        <span className="text-green-400 font-bold uppercase text-[10px] tracking-widest block mb-2 relative z-10">Primary Outcome</span>
                        <p className="text-sm text-gray-200 leading-relaxed relative z-10">{report.primaryScenario}</p>
                        </div>
                        <div className="p-5 bg-gradient-to-b from-gold/10 to-transparent border-t-2 border-gold rounded-b-xl shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-5"><RefreshCw className="w-16 h-16"/></div>
                        <span className="text-gold font-bold uppercase text-[10px] tracking-widest block mb-2 relative z-10">{isChart ? "Secondary" : "Alternative"}</span>
                        <p className="text-sm text-gray-200 leading-relaxed relative z-10">{report.secondaryScenario || report.alternativeScenario}</p>
                        </div>
                        <div className="p-5 bg-gradient-to-b from-red-500/10 to-transparent border-t-2 border-red-500 rounded-b-xl shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-5"><ShieldAlert className="w-16 h-16"/></div>
                        <span className="text-red-400 font-bold uppercase text-[10px] tracking-widest block mb-2 relative z-10">Invalidation</span>
                        <p className="text-sm text-gray-200 leading-relaxed relative z-10">{report.invalidation}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div className="glass-card p-6 rounded-2xl border border-white/10 shadow-lg relative h-[400px] flex flex-col">
                        <h3 className="text-xs font-bold text-gold uppercase tracking-widest flex items-center gap-2 mb-4 shrink-0">
                        <Target className="w-4 h-4" /> Live Technical Plot
                        </h3>
                        <div className="flex-1 min-h-[300px]">
                        <LiveAnalysisChart pair={pair} bias={report.bias as any} technicalLevels={report.technicalLevels} />
                        </div>
                    </div>
                    {report.fundamentalScores && (
                        <div className="glass-card p-6 rounded-2xl border border-white/10 shadow-lg relative h-[400px] flex flex-col">
                        <h3 className="text-xs font-bold text-gold uppercase tracking-widest flex items-center gap-2 mb-4 shrink-0">
                            <Activity className="w-4 h-4" /> Fundamental Context
                        </h3>
                        <div className="flex-1 min-h-[300px]">
                            <FundamentalAnalysisChart scores={report.fundamentalScores} />
                        </div>
                        </div>
                    )}
                </div>
                
                {report.explanation && (
                    <div className="mt-8 p-6 glass-card rounded-2xl border border-white/10 shadow-lg">
                        <h4 className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-3 flex items-center gap-2"><Brain className="w-4 h-4 text-gray-500" /> Explanation</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {report.explanation}
                        </p>
                    </div>
                )}
             </div>
        </div>
    );
}
