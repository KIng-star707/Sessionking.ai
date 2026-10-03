import React, { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import { UploadCloud, Image as ImageIcon, X, Brain, ShieldAlert, Target, TrendingUp, TrendingDown, AlignLeft, BarChart2, Cpu, FileText, CheckCircle2, Share2, AlertTriangle } from "lucide-react";
import LiveAnalysisChart from "./LiveAnalysisChart";
import { cn, isMarketWeekend } from "../lib/utils";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface ChartIntelligenceEngineProps {
  user: any;
  userProfile: any;
  usagesRemaining: number;
  onProceedToPayment: () => void;
}

export default function ChartIntelligenceEngine({ user, userProfile, usagesRemaining, onProceedToPayment }: ChartIntelligenceEngineProps) {
  const [images, setImages] = useState<{ url: string; file: File }[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.email === 'dekingsjackson@gmail.com' || 
                  user?.email === 'system-backend@sessionking.com' ||
                  userProfile?.role === 'admin' || 
                  userProfile?.role === 'super_admin';

  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const { doc, onSnapshot } = await import("firebase/firestore");
        unsub = onSnapshot(doc(db, "system", "config"), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setIsMaintenanceMode(Boolean(data?.killSwitch));
          } else {
            setIsMaintenanceMode(false);
          }
        }, (err) => {
          console.warn("[ChartIntelligenceEngine] Config listener error:", err);
        });
      } catch (err) {
        console.warn("[ChartIntelligenceEngine] Failed to setup config snapshot:", err);
      }
    })();

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (!report) return;
    setIsSharing(true);
    try {
        const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
        // Create a public shared report document
        const shareRef = await addDoc(collection(db, "sharedAnalyses"), {
           type: "chart_analysis",
           pair: report.detectedPair,
           report: report,
           createdAt: serverTimestamp(),
           createdBy: userProfile?.displayName || "Anonymous Trader"
        });
        
        const shareUrl = `${window.location.origin}?share=${shareRef.id}`;
        
        const shareData = {
           title: 'SESSIONKING - Advanced Chart Analysis',
           text: `Check out this institutional chart analysis for ${report.detectedPair} by SESSIONKING Terminal. Bias: ${report.bias}, Timeframe: ${report.detectedTimeframe}.`,
           url: shareUrl,
        };
        
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
            toast.success("Analysis secure link generated and copied to clipboard!");
        }
    } catch(err) {
        if ((err as Error).name !== 'AbortError') {
             console.error("Error sharing: ", err);
             toast.error("Failed to generate shareable link.");
        }
    } finally {
        setIsSharing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    // Create preview URLs
    const newImages = files.map(file => ({
      file,
      url: URL.createObjectURL(file)
    }));
    
    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].url);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        let encoded = reader.result as string;
        // Remove data:image/*;base64, prefix
        encoded = encoded.split(',')[1];
        resolve(encoded);
      };
      reader.onerror = error => reject(error);
    });
  };

  const analyzeCharts = async () => {
    if (!user) return;
    
    // Weekend check disabled here so users can analyze crypto charts or backtest data
    
    if (images.length === 0) return;
    if (usagesRemaining <= 0) {
      onProceedToPayment();
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setReport(null);

    try {
      const { fetchGeminiProxy } = await import("../services/geminiService");
      const { doc, getDoc, collection, addDoc, serverTimestamp } = await import("firebase/firestore");

      const configSnap = await getDoc(doc(db, "system", "config"));
      const sysConfig = configSnap.exists() ? configSnap.data() : null;
      if (sysConfig?.killSwitch && !isAdmin) {
         throw new Error("The Terminal is currently under maintenance by the Admin. You will be notified once the system is restored.");
      }

      const parts: any[] = [];
      const userMemory = `User Trading Mode: ${userProfile?.tradingMode || "Unknown"}, Preferred Pairs: ${(userProfile?.preferredPairs || []).join(", ") || "Unknown"}`;

      for (const img of images) {
        const base64Data = await toBase64(img.file);
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: img.file.type,
          }
        });
      }

      const promptText = `You are SESSIONKING AI, the ultimate Institutional Chart Engine. You are analyzing ${images.length} chart screenshots.
 Tasks:
	1. MARKET REGIME DETECTION: Detect Trending, Ranging, Breakout, Reversal, Pullback, Expansion, Compression, Consolidation, High/Low Volatility, News Driven, Liquidity Sweep, Institutional Accumulation/Distribution.
	2. MULTI-TIMEFRAME CONTEXT: Extract the Pair & Timeframes (Weekly, Daily, H4, H1 if visible).
	3. INSTITUTIONAL SMC: Identify sweeps, order blocks, FVG, and liquidity pools.
	4. MULTI-LAYER CONFIRMATION: Verify Market Structure, Momentum, Volume, Volatility. Explain how retail liquidity is being trapped.
	5. AI DECISION MODEL: Evaluate if institutional behavior confirms the setup, if volatility is appropriate, and if the reward is worth the risk. Provide a clear and objective confidence assessment based on these factors.
	6. USER PREFERENCES: ${userMemory}. Tweak analysis based on input.

	Respond STRICTLY in the JSON Schema.`;parts.push({ text: promptText });
      
      const responseSchema = {
        type: "OBJECT",
        properties: {
          detectedPair: { type: "STRING", description: "e.g., EURUSD" },
          detectedTimeframe: { type: "STRING", description: "e.g., H1, or Mixed if multiple" },
          bias: { type: "STRING", enum: ["Bullish", "Bearish", "Neutral"] },
          trendStrength: { type: "STRING", enum: ["Weak", "Moderate", "Strong"] },
          marketCondition: { type: "STRING", enum: ["Trending", "Ranging", "Breakout", "Reversal", "Pullback", "Expansion", "Compression", "Consolidation", "High Volatility", "Low Volatility", "News Driven", "Liquidity Sweep", "Institutional Accumulation", "Institutional Distribution"] },
          confidenceScore: { type: "INTEGER" },
          smartMoneyFlow: { type: "STRING", enum: ["Bullish", "Bearish", "Neutral"] },
          rsiStatus: { type: "STRING", enum: ["Overbought", "Oversold", "Neutral", "Not Visible"] },
          macdStatus: { type: "STRING" },
          emaAlignment: { type: "STRING" },
          liquidityStatus: { type: "STRING" },
          volatility: { type: "STRING", enum: ["Low", "Medium", "High"] },
          highReasoning: { type: "STRING", description: "Deep institutional logic on market structure, liquidity, etc." },
          primaryScenario: { type: "STRING" },
          secondaryScenario: { type: "STRING" },
          invalidation: { type: "STRING", description: "At what price is this bias invalidated?" },
          entryAdvice: { type: "STRING", description: "Detailed advice on possible entry points, stop loss positioning, and target levels based on the analysis of the uploaded chart." },
          setupQualityPoor: { type: "BOOLEAN", description: "True if the chart has no clear, high-probability setup." },
          poorSetupReason: { type: "STRING", description: "Required if setupQualityPoor is true." },
          technicalLevels: {
            type: "OBJECT",
            description: "Numerical price levels for technical analysis chart plotting.",
            properties: {
              currentPrice: { type: "NUMBER" },
              entryPrice: { type: "NUMBER" },
              stopLoss: { type: "NUMBER" },
              takeProfit1: { type: "NUMBER" },
              takeProfit2: { type: "NUMBER" },
              supportLevel: { type: "NUMBER" },
              resistanceLevel: { type: "NUMBER" }
            }
          },
          education: {
            type: "OBJECT",
            properties: {
              beginnerNote: { type: "STRING" },
              proInsight: { type: "STRING" },
              riskWarning: { type: "STRING" }
            }
          }
        },
        required: ["detectedPair", "detectedTimeframe", "bias", "trendStrength", "marketCondition", "confidenceScore", "smartMoneyFlow", "rsiStatus", "macdStatus", "emaAlignment", "liquidityStatus", "volatility", "highReasoning", "primaryScenario", "secondaryScenario", "invalidation", "entryAdvice", "setupQualityPoor", "education"]
      };

      const response = await fetchGeminiProxy({
        feature: "intelligence",
        model: "gemini-2.5-flash",
        contents: { parts },
        config: {
          systemInstruction: "You are the advanced Chart Vision Intel Core of SESSIONKING Terminal.",
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      });

      const rawText = response.text || "{}";
      let resultObj: any;
      try {
        const cleanText = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "").trim();
        resultObj = JSON.parse(cleanText);
      } catch (parseErr) {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          resultObj = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Unable to parse chart intelligence response.");
        }
      }
      setReport(resultObj);
      
      // Save AI log for orchestrator
      try {
         const diagnostic = [];
         if (resultObj.confidenceScore < 60) diagnostic.push("Low confidence score detected by system.");
         if (resultObj.setupQualityPoor) diagnostic.push("Chart setup identified as poor or low probability.");
         if (parts.length > 2) diagnostic.push("Multi-timeframe input provided.");
         
         await addDoc(collection(db, "aiLogs"), {
            type: "CHART ENTRY",
            pair: resultObj.detectedPair || "UNKNOWN",
            timeframe: resultObj.detectedTimeframe || "MIXED",
            userEmail: user.email || user.uid,
            confidenceScore: resultObj.confidenceScore || 0,
            setupQualityPoor: !!resultObj.setupQualityPoor,
            createdAt: serverTimestamp(),
            rawOutput: response.text,
            diagnostic
         });
      } catch (e) { console.error("Logging failed", e); }

      // Store in chartAnalysis
      await addDoc(collection(db, `users/${user.uid}/chartAnalysis`), {
        pair: resultObj.detectedPair,
        timeframe: resultObj.detectedTimeframe,
        analysis: resultObj,
        confidence: resultObj.confidenceScore,
        bias: resultObj.bias,
        createdAt: serverTimestamp()
      });

    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('Insufficient intelligence credits')) {
         setError("Insufficient intelligence credits. Please verify payment.");
      } else {
         setError(err.message || "AI Vision Engine failed to process images. Please try again.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Maintenance Alert Banner */}
      {isMaintenanceMode && (
        <div className={cn(
          "p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs",
          isAdmin 
            ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
            : "bg-red-500/10 border-red-500/30 text-red-300"
        )}>
          <div className="flex items-center gap-2.5">
            <AlertTriangle className={cn("w-5 h-5 flex-shrink-0", isAdmin ? "text-amber-400" : "text-red-400 animate-pulse")} />
            <div>
              <span className="font-bold uppercase tracking-wider block">
                {isAdmin ? "Admin Notice: Chart Vision Engine Maintenance Active" : "Scheduled Vision Engine Maintenance"}
              </span>
              <span className="text-[11px] opacity-80">
                {isAdmin 
                  ? "Maintenance mode is enabled for standard users. Administrator bypass is active." 
                  : "The Chart Intelligence Engine is undergoing maintenance. Features will be restored shortly."}
              </span>
            </div>
          </div>
          {isAdmin && (
            <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap self-end sm:self-center">
              Admin Bypass Enabled
            </span>
          )}
        </div>
      )}

      {/* Upload Console */}
      <div className="glass-card p-6 md:p-8 rounded-2xl border border-blue-500/20 shadow-[0_0_40px_rgba(0,123,255,0.1)] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-deep-blue/10 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
          
          <div className="flex-1 w-full space-y-6">
            <div>
              <h2 className="text-xl font-bold font-serif uppercase tracking-widest text-white mb-2 flex items-center gap-2">
                <Brain className="w-5 h-5 text-blue-400" /> Chart Upload Console
              </h2>
              <p className="text-gray-400 text-sm">
                Upload TradingView, MT5, or mobile screenshots. The AI Vision Engine will extract market context, detect indicators, and generate an institutional confluence report.
              </p>
            </div>
            
            <div 
              className={cn(
                "border-2 border-dashed border-gray-600 rounded-2xl p-8 text-center transition-all hover:border-blue-400 hover:bg-blue-500/5 cursor-pointer",
                images.length > 0 ? "py-6" : "py-12"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                multiple 
                accept="image/png, image/jpeg, image/jpg" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleImageUpload}
              />
              <div className="flex flex-col items-center gap-3 pointer-events-none">
                <UploadCloud className="w-10 h-10 text-gray-500" />
                <div>
                  <span className="text-white font-bold block mb-1">Click to Upload Charts</span>
                  <span className="text-xs text-gray-500">Supports PNG, JPG (Multi-timeframe allowed)</span>
                </div>
              </div>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((img, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden border border-white/10 aspect-video bg-black/50">
                    <img src={img.url} alt="Chart upload" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    <button 
                      onClick={() => removeImage(i)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500/80 rounded-full text-white backdrop-blur-sm transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="pt-2">
               {isMaintenanceMode && !isAdmin ? (
                 <button 
                   disabled
                   className="w-full py-4 rounded-xl bg-gradient-to-r from-gray-900 to-black border border-red-500/20 text-gray-400 font-bold flex flex-col items-center justify-center gap-1 shadow-lg cursor-not-allowed"
                 >
                   <AlertTriangle className="w-5 h-5 text-amber-500" />
                   <span className="text-sm text-amber-400">Vision Engine Under Maintenance</span>
                   <span className="text-[10px] text-gray-500 font-normal">Chart intelligence operations are temporarily paused for updates</span>
                 </button>
               ) : (
                 <button 
                    onClick={analyzeCharts} 
                    disabled={isAnalyzing || images.length === 0 || usagesRemaining <= 0}
                    className="w-full relative group overflow-hidden rounded-xl border border-blue-500/50 bg-gradient-to-r from-blue-600/20 to-deep-blue/40 hover:from-blue-500/30 hover:to-deep-blue/50 transition-all p-4 shadow-[0_0_20px_rgba(0,123,255,0.15)] disabled:opacity-50"
                  >
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
                    {isAnalyzing ? (
                      <div className="flex items-center justify-center gap-3 relative z-10">
                        <span className="text-blue-400 font-bold tracking-widest uppercase text-sm">Vision Engine Scanning...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3 relative z-10">
                        <Brain className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                        <span className="text-white font-bold tracking-widest uppercase text-sm group-hover:text-blue-400 transition-colors">
                          {isMaintenanceMode && isAdmin ? "Launch Intelligence Report [Admin Override] (1 Usage)" : "Launch Intelligence Report (1 Usage)"}
                        </span>
                      </div>
                    )}
                  </button>
               )}
                {error && <div className="mt-3 text-red-400 text-xs text-center p-2 bg-red-500/10 rounded-lg border border-red-500/20">{error}</div>}
            </div>
            
          </div>
          
          
          
        </div>
      </div>

      {isAnalyzing && (
        <div className="glass-card p-12 rounded-2xl border border-blue-500/20 shadow-lg text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cyber-locks.png')] opacity-10 pointer-events-none" />
          <motion.div animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>
            <ImageIcon className="w-20 h-20 text-blue-500/50 mx-auto mb-6" />
          </motion.div>
          <h3 className="text-xl font-mono text-blue-400 mb-4 uppercase font-bold tracking-widest">Processing Imagery</h3>
          <p className="text-sm text-gray-400 mb-6 w-full max-w-sm mx-auto">
            Extracting candlestick patterns, deciphering liquidity zones, and mapping indicator overlays...
          </p>
          <div className="w-64 h-1 bg-black/50 rounded-full mx-auto overflow-hidden">
            <motion.div 
               className="h-full bg-blue-500" 
               initial={{ width: 0, x: 0 }} 
               animate={{ width: "30%", x: ["0%", "300%"] }} 
               transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </div>
      )}

      {/* Output Render */}
      <AnimatePresence>
        {report && !isAnalyzing && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex justify-end mb-2">
              <button onClick={handleShare} disabled={isSharing} className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-sm transition-colors border border-blue-500/20 font-bold tracking-widest uppercase">
                  <Share2 className="w-4 h-4" /> Share Intelligence
              </button>
            </div>

            {report.setupQualityPoor && (
              <div className="p-5 bg-red-950/40 border-l-4 border-l-red-500 border-y border-r border-red-500/20 rounded-r-xl flex items-start gap-4">
                <ShieldAlert className="w-6 h-6 text-red-500 shrink-0 mt-1" />
                <div>
                  <h4 className="text-red-400 font-bold uppercase tracking-widest text-sm mb-2">⚠ Low Probability Setup Detected</h4>
                  <p className="text-sm text-gray-300">{report.poorSetupReason}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
               
               {/* Left Column: Core Data */}
               <div className="md:col-span-4 space-y-6">
                 <div className="glass-card p-6 rounded-2xl border border-white/10 shadow-lg">
                   <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                     <FileText className="w-4 h-4 text-blue-400" /> Chart Metadata
                   </h3>
                   <div className="space-y-4">
                     <div>
                       <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Detected Pair</span>
                       <span className="text-lg font-bold text-white font-mono">{report.detectedPair}</span>
                     </div>
                     <div>
                       <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Timeframe Context</span>
                       <span className="text-sm font-semibold text-gray-300">{report.detectedTimeframe}</span>
                     </div>
                     <div className="pt-2 border-t border-white/5">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-2">Market Bias</span>
                        <div className={cn(
                          "px-4 py-2 font-bold uppercase rounded-lg inline-flex items-center gap-2",
                          report.bias === "Bullish" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                          report.bias === "Bearish" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                        )}>
                          {report.bias === "Bullish" ? <TrendingUp className="w-4 h-4"/> : report.bias === "Bearish" ? <TrendingDown className="w-4 h-4"/> : <AlignLeft className="w-4 h-4"/>}
                          {report.bias}
                        </div>
                     </div>
                     <div className="pt-4">
                        <span className="text-gray-400 text-xs uppercase mb-2 flex justify-between tracking-widest font-bold">
                          <span>AI Pattern Confidence</span>
                          <span className="text-blue-400 font-mono">{report.confidenceScore}%</span>
                        </span>
                        <div className="w-full bg-black/80 rounded-full h-2 overflow-hidden">
                          <motion.div 
                            className="h-2 rounded-full bg-blue-500" 
                            initial={{ width: 0 }} 
                            animate={{ width: `${report.confidenceScore}%` }} 
                            transition={{ duration: 1 }}
                          />
                        </div>
                      </div>
                   </div>
                 </div>

                 {/* Tech Profile */}
                 <div className="glass-card p-5 rounded-2xl border border-white/10 shadow-lg">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Visual Extractions</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Condition</span>
                        <span className="text-white font-medium">{report.marketCondition}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">RSI Status</span>
                        <span className="text-white font-medium">{report.rsiStatus}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">MACD</span>
                        <span className="text-white font-medium">{report.macdStatus}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">EMA Align</span>
                        <span className="text-white font-medium">{report.emaAlignment}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Liq. Status</span>
                        <span className="text-white font-medium truncate max-w-[120px]" title={report.liquidityStatus}>{report.liquidityStatus}</span>
                      </div>
                    </div>
                 </div>
               </div>

               {/* Right Column: Reasoning & Education */}
               <div className="md:col-span-8 space-y-6">
                 
                 <div className="glass-card p-6 md:p-8 rounded-2xl border border-white/10 shadow-lg bg-gradient-to-br from-black/80 to-transparent relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-8 opacity-5"><Brain className="w-32 h-32"/></div>
                   <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2 mb-4 uppercase tracking-widest">
                     <Cpu className="w-5 h-5" /> High-Reasoning Institutional Logic
                   </h3>
                   <p className="text-sm text-gray-200 leading-relaxed relative z-10 border-l-2 border-blue-500/50 pl-4">
                     {report.highReasoning}
                   </p>
                 </div>

                 {/* Entry Advice */}
                 <div className="glass-card p-6 md:p-8 rounded-2xl border border-blue-500/20 bg-blue-900/10 shadow-lg relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-8 opacity-10"><Target className="w-24 h-24 text-blue-400" /></div>
                   <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2 mb-3 uppercase tracking-widest relative z-10">
                     <Target className="w-5 h-5" /> Possible Entry Strategy
                   </h3>
                   <p className="text-sm text-gray-200 leading-relaxed relative z-10">
                     {report.entryAdvice}
                   </p>
                 </div>

                 {/* Scenarios */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-green-500/5 border-t-2 border-green-500 p-4 rounded-b-xl">
                      <span className="text-green-400 font-bold uppercase text-[10px] tracking-widest block mb-2">Primary Scenario</span>
                      <p className="text-xs text-gray-300">{report.primaryScenario}</p>
                    </div>
                    <div className="bg-gold/5 border-t-2 border-gold p-4 rounded-b-xl">
                      <span className="text-gold font-bold uppercase text-[10px] tracking-widest block mb-2">Secondary Scenario</span>
                      <p className="text-xs text-gray-300">{report.secondaryScenario}</p>
                    </div>
                    <div className="bg-red-500/5 border-t-2 border-red-500 p-4 rounded-b-xl">
                      <span className="text-red-400 font-bold uppercase text-[10px] tracking-widest block mb-2">Invalidation Level</span>
                      <p className="text-xs text-gray-300">{report.invalidation}</p>
                    </div>
                 </div>

                 {/* Educational Corner */}
                 <div className="glass-card p-6 rounded-2xl border border-white/5 bg-deep-blue/10">
                   <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                     <Brain className="w-4 h-4 text-purple-400" /> Educational Breakdown
                   </h3>
                   <div className="space-y-4">
                     <div className="flex gap-4">
                        <div className="w-1.5 h-auto bg-blue-400 rounded-full shrink-0" />
                        <div>
                          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Beginner Note</span>
                          <p className="text-xs text-gray-300">{report.education.beginnerNote}</p>
                        </div>
                     </div>
                     <div className="flex gap-4">
                        <div className="w-1.5 h-auto bg-purple-400 rounded-full shrink-0" />
                        <div>
                          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block mb-1">Pro Insight</span>
                          <p className="text-xs text-gray-300">{report.education.proInsight}</p>
                        </div>
                     </div>
                     <div className="flex gap-4 p-3 bg-red-950/30 rounded-lg">
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block mb-1">Risk & Common Mistake</span>
                          <p className="text-xs text-gray-300">{report.education.riskWarning}</p>
                        </div>
                     </div>
                   </div>
                 </div>

                 {/* Live Chart View */}
                 <div className="glass-card p-6 rounded-2xl border border-white/5 bg-deep-blue/10 min-h-[520px] flex flex-col">
                   <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2 shrink-0">
                     <BarChart2 className="w-4 h-4 text-blue-400" /> Live Market Verification
                   </h3>
                   <div className="flex-1 min-h-[420px]">
                     <LiveAnalysisChart pair={report.detectedPair} bias={report.bias as any} technicalLevels={report.technicalLevels} />
                   </div>
                 </div>

               </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
