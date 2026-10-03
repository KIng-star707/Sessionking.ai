import React, { useState, useEffect, useRef, useMemo } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";

import { Sparkles, Brain, Cpu, Wifi, Activity, Terminal as TerminalIcon, ShieldAlert, ArrowRight, ArrowUpRight, ArrowDownRight, Clock, AlertTriangle, ChevronRight, Lock, Target, TrendingUp, TrendingDown, AlignLeft, RefreshCw, BarChart2, Image as ImageIcon, Share2, ShieldCheck } from "lucide-react";
import LiveAnalysisChart from "./LiveAnalysisChart";
import FundamentalAnalysisChart from "./FundamentalAnalysisChart";
import { cn, isMarketWeekend } from "../lib/utils";
import { usePriceFeed } from "../hooks/usePriceFeed";
import { auth, db } from "../firebase";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import { usePaystackPayment } from "../lib/paystack";
import ChartIntelligenceEngine from "./ChartIntelligenceEngine";

interface OHLC {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

const getSession = () => {
  const hour = new Date().getUTCHours();
  if (hour >= 13 && hour <= 16) return "London/NY Overlap";
  if (hour >= 8 && hour <= 16) return "London Session";
  if (hour >= 13 && hour <= 22) return "New York Session";
  return "Asian/Sydney Session";
};

const getActivePairsForSession = (session: string) => {
  const asianPairs = ["AUD/USD", "NZD/USD", "USD/JPY", "AUD/JPY", "NZD/JPY", "EUR/JPY", "GBP/JPY", "BTC/USD", "ETH/USD"];
  const londonPairs = ["EUR/USD", "GBP/USD", "EUR/GBP", "USD/CHF", "EUR/CHF", "GBP/CHF", "XAU/USD", "BTC/USD", "ETH/USD"];
  const nyPairs = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CAD", "USD/CHF", "XAU/USD", "XAG/USD", "BTC/USD", "ETH/USD"];
  
  if (session === "London/NY Overlap") {
    return Array.from(new Set([...londonPairs, ...nyPairs]));
  }
  if (session === "London Session") return londonPairs;
  if (session === "New York Session") return nyPairs;
  return asianPairs;
};

interface IntelligenceTerminalProps {
  user: any;
  userProfile: any;
  onExit: () => void;
  onProceedToPayment: () => void;
}

const STYLES = ["Scalping", "Day Trading", "Swing Trading"];
const TIMEFRAMES = ["M5", "M15", "H1", "H4", "D1"];

export default function IntelligenceTerminal({ user, userProfile, onExit, onProceedToPayment }: IntelligenceTerminalProps) {
  const { prices, directions } = usePriceFeed();
  
  const [currentSession, setCurrentSession] = useState(getSession());
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [rates, setRates] = useState<any>(null);

  useEffect(() => {
    fetch('/api/payment-rates')
      .then(res => res.json())
      .then(data => {
        if (data && data.rates) {
          setRates(data.rates);
        }
      })
      .catch(err => console.warn("Failed to load rates:", err.message || err));
  }, []);

  const getPriceCents = () => {
    if (rates && rates.intelligence) {
      return Math.round(rates.intelligence * 100);
    }
    return 5 * 1500 * 100; // Fallback
  };

  const handlePaymentSuccess = async (reference: any) => {
    try {
      setLoadingPayment(true);
      const auth = await import("firebase/auth").then(m => m.getAuth());
      const token = await auth.currentUser?.getIdToken();
      
      const res = await fetch("/api/verify-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          reference: reference.reference,
          type: "intelligence",
          planName: "intelligence",
          amount: getPriceCents()
        })
      });
      
      if (!res.ok) {
        throw new Error("Server verification failed");
      }
      
      toast.success("Payment successful! Intelligence usages have been added.");
      
      // Assume local listener will update credits soon.
    } catch (e) {
      console.error(e);
      toast.error("Payment was successful but verification failed. Please contact support.");
    } finally {
      setLoadingPayment(false);
    }
  };

  const initializePayment = usePaystackPayment({
    reference: (new Date()).getTime().toString(),
    email: user?.email || "",
    amount: 0,
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_placeholder",
  } as any);

  const initiatePurchase = () => {
    if (!user) return;
    const amount = getPriceCents();
    initializePayment({
        onSuccess: (ref: any) => handlePaymentSuccess(ref),
        onClose: () => {
           console.log("Payment modal closed");
        },
        config: {
           reference: (new Date()).getTime().toString(),
           email: user.email,
           amount: amount,
           publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_placeholder",
           metadata: {
             type: "intelligence",
             planName: "intelligence",
             userId: user.uid
           }
        }
    } as any);
  };
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSession(getSession());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const activePairs = useMemo(() => getActivePairsForSession(currentSession), [currentSession]);
  
  const [activeTab, setActiveTab] = useState<"market" | "chart">("market");

  const [pair, setPair] = useState(activePairs[0] || "EUR/USD");
  
  useEffect(() => {
    if (activePairs.length > 0 && !activePairs.includes(pair)) {
      setPair(activePairs[0]);
    }
  }, [activePairs, pair]);

  const [style, setStyle] = useState("Day Trading");
  const [timeframe, setTimeframe] = useState("H1");
  const [question, setQuestion] = useState("");
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(false);

  const isAdmin = useMemo(() => {
    return user?.email === 'dekingsjackson@gmail.com' || 
           user?.email === 'system-backend@sessionking.com' ||
           userProfile?.role === 'admin' || 
           userProfile?.role === 'super_admin';
  }, [user?.email, userProfile?.role]);

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
          console.warn("[IntelligenceTerminal] Config listener error:", err);
        });
      } catch (err) {
        console.warn("[IntelligenceTerminal] Failed to setup config snapshot:", err);
      }
    })();

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const usagesRemaining = userProfile?.intelligenceCredits || 0;
  
  const requirePayment = usagesRemaining <= 0;
  const [showExhaustedModal, setShowExhaustedModal] = useState(false);
  
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (!report) return;
    setIsSharing(true);
    try {
        const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
        // Create a public shared report document
        const shareRef = await addDoc(collection(db, "sharedAnalyses"), {
           type: "market_analysis",
           pair: pair,
           report: report,
           createdAt: serverTimestamp(),
           createdBy: userProfile?.displayName || "Anonymous Trader"
        });
        
        const shareUrl = `${window.location.origin}?share=${shareRef.id}`;
        
        const shareData = {
           title: 'SESSIONKING - Market Intelligence',
           text: `Check out this institutional market analysis for ${pair} by SESSIONKING Terminal. Bias: ${report.bias}, Condition: ${report.marketCondition}.`,
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

  const handleAnalyze = async () => {
    if (!user) return;
    if (isAnalyzing) return; // Protect against concurrent duplicate requests
    
    const currentCredits = userProfile?.intelligenceCredits ?? 0;
    if (currentCredits <= 0) {
      setShowExhaustedModal(true);
      return; // Do NOT proceed, DO NOT consume API resources
    }

    setIsAnalyzing(true);
    setError(null);
    setReport(null);
    
    try {
      const auth = await import("firebase/auth").then(m => m.getAuth());
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const { fetchGeminiProxy } = await import("../services/geminiService");
      const { doc, getDoc, collection, addDoc, serverTimestamp, updateDoc } = await import("firebase/firestore");
      
      const configSnap = await getDoc(doc(db, "system", "config"));
      const sysConfig = configSnap.exists() ? configSnap.data() : null;
      if (sysConfig?.killSwitch && !isAdmin) {
         throw new Error("The Terminal is currently under maintenance by the Admin. You will be notified once the system is restored.");
      }
      const priceContext = `Current Price: ${prices[pair] || "Unknown"} Direction: ${directions[pair] || "Neutral"}`;
      const newsContext = "";
      
      const prompt = `You are SESSIONKING AI, an elite institutional-grade Forex market intelligence assistant.
User requesting analysis: ${userProfile?.displayName || 'Trader'}. Address them professionally.
Analyze the following market condition request and return a structured JSON report.
Do NOT guarantee profits. Be extremely professional (Bloomberg terminal style).

--- INTELLIGENCE TERMINAL RESPONSIBILITIES ---
You are responsible for understanding the market. Never rely on a single strategy. Build a complete market intelligence profile.
1. MARKET REGIME DETECTION: Classify the market before any strategy is evaluated. Detect: Trending, Ranging, Breakout, Reversal, Pullback, Expansion, Compression, Consolidation, High Volatility, Low Volatility, News Driven, Liquidity Sweep, Institutional Accumulation, Institutional Distribution.
2. TOP-DOWN MARKET CONTEXT: Always analyze Weekly, Daily, H4, and H1. Determine Market Bias, Trend Direction, Market Structure, Institutional Direction, Liquidity Position, Trend Strength, Momentum Environment, Support & Resistance Context. This defines the market context.
3. ADAPTIVE STRATEGY SELECTION: Activate strategies dynamically based on the detected market regime.
   - Trending: trend continuation, CRT continuation, order blocks, EMA structure, momentum confirmation. Disable mean reversion/counter-trend.
   - Ranging: Quasimodo, support/resistance, Bollinger-based mean reversion, range trading. Reduce trend-following weight.
   - Breakout: breakout confirmation, liquidity sweep detection, ATR expansion, volume confirmation.
   - Reversal: Quasimodo reversal, CRT reversal, BOS, CHOCH, order blocks, fair value gaps, liquidity sweeps.
4. MULTI-LAYER CONFIRMATION: Every market assessment must pass Top-Down Context, Market Structure, Strategy Agreement, Institutional Confirmation, Momentum, Volume, Volatility, Session, Economic Event Awareness, and Risk Validation.
5. ADVANCED CONFIRMATION TOOLS: Use EMA 20/50/100/200, ADX, ATR, RSI, MACD, StochRSI, VWAP, Relative/Tick Volume, MA Slope, Momentum Oscillator, Average Candle Range for validation only. They do not replace primary trading strategies.
6. AI DECISION MODEL: Do not ask "Which strategy generated a trade?". Instead ask: What market regime exists? Which strategies fit this regime? Does higher-timeframe context support the setup? Does institutional behavior confirm it? Does momentum support continuation? Is volatility appropriate? Is liquidity sufficient? Is the expected reward worth the risk? Evaluate confidence dynamically based on these confirmations.

Pair: ${pair}
Timeframe: ${timeframe}
Style: ${style}
Current Price Info: ${priceContext}
Current Live Session: ${currentSession}
High Impact News today: ${newsContext || "None"}
User's specific question (if any): ${question || "Analyze market structure and probability"}

Generate an institutional report matching the requested JSON schema exactly.`;

      // Define schema natively matching what Type.OBJECT mapped to
      const responseSchema = {
        type: "OBJECT",
        properties: {
          bias: { type: "STRING", enum: ["Bullish", "Bearish", "Neutral"] },
          trendStrength: { type: "STRING", enum: ["Weak", "Moderate", "Strong"] },
          marketCondition: { type: "STRING", enum: ["Trending", "Ranging", "Breakout", "Reversal", "Pullback", "Expansion", "Compression", "Consolidation", "High Volatility", "Low Volatility", "News Driven", "Liquidity Sweep", "Institutional Accumulation", "Institutional Distribution"] },
          confidenceScore: { type: "INTEGER", description: "0 to 100" },
          smartMoneyFlow: { type: "STRING", enum: ["Bullish", "Bearish", "Neutral", "Mixed"] },
          rsiStatus: { type: "STRING", enum: ["Overbought", "Oversold", "Neutral"] },
          macdStatus: { type: "STRING", enum: ["Bullish crossover", "Bearish crossover", "Neutral"] },
          emaAlignment: { type: "STRING", enum: ["Bullish", "Bearish", "Mixed"] },
          volatility: { type: "STRING", enum: ["Low", "Medium", "High"] },
          newsRisk: { type: "STRING", enum: ["Low", "Medium", "High"] },
          bestSession: { type: "STRING" },
          primaryScenario: { type: "STRING", description: "If the current bias plays out..." },
          alternativeScenario: { type: "STRING", description: "If the trend breaks..." },
          invalidation: { type: "STRING", description: "Level where bias is invalidated" },
          recommendations: {
            type: "OBJECT",
            properties: {
              lotSizeInfo: { type: "STRING" },
              riskPercent: { type: "STRING" },
              shouldAvoid: { type: "BOOLEAN" },
              avoidReason: { type: "STRING" }
            }
          },
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
          fundamentalScores: {
            type: "OBJECT",
            description: "Macro fundamental scores evaluated on a scale of 0 to 10.",
            properties: {
              economicGrowth: { type: "NUMBER" },
              inflation: { type: "NUMBER" },
              interestRates: { type: "NUMBER" },
              geopolitics: { type: "NUMBER" },
              marketSentiment: { type: "NUMBER" }
            }
          },
          explanation: { type: "STRING", description: "Educational reasoning explaining WHY this analysis was formed. Must mention specific indicators." },
          chatResponse: { type: "STRING", description: "A direct conversational reply to the user's specific question, if any." }
        },
        required: ["bias", "trendStrength", "marketCondition", "confidenceScore", "smartMoneyFlow", "rsiStatus", "macdStatus", "emaAlignment", "volatility", "newsRisk", "bestSession", "primaryScenario", "alternativeScenario", "invalidation", "recommendations", "explanation"]
      };

      const response = await fetchGeminiProxy({
        feature: "intelligence",
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are the Intelligence Core of a premium institutional trading terminal.",
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
          throw new Error("Unable to parse intelligence analysis report.");
        }
      }
      setReport(resultObj);
      
      // Save AI log for orchestrator
      try {
         const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
         const diagnostic = [];
         if (resultObj.confidenceScore < 60) diagnostic.push("Low confidence score detected by system.");
         if (resultObj.recommendations?.shouldAvoid) diagnostic.push("System advised avoiding trading.");
         
         await addDoc(collection(db, "aiLogs"), {
            type: "MARKET SCAN",
            pair,
            timeframe,
            userEmail: user.email || user.uid,
            confidenceScore: resultObj.confidenceScore || 0,
            setupQualityPoor: !!resultObj.recommendations?.shouldAvoid,
            createdAt: serverTimestamp(),
            rawOutput: response.text,
            diagnostic
         });
      } catch (e) { console.error("Logging failed", e); }
      
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('Insufficient intelligence credits')) {
         setShowExhaustedModal(true);
         return;
      }
      if (err.message && err.message.toLowerCase().includes('fetch')) {
         setError("Network Error: Could not reach the AI Intelligence servers. Please check your connection.");
      } else if (err.status === 429 || (err.message && err.message.includes('429'))) {
         setError("Rate Limit Exceeded: The AI engine is currently under heavy load. Please try again in a few moments.");
      } else if (err.status === 400 || (err.message && err.message.includes('400'))) {
         setError("Invalid Request: The parameters provided could not be processed.");
      } else if (err.message?.includes("Invalid API Key") || String(err).includes("Invalid API Key")) {
        setError("AI Core offline: API key missing.");
      } else {
        setError("Failed to generate institutional report. Please try again.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-20 px-3.5 sm:px-6 lg:px-8 bg-matte-black text-gray-100 font-sans selection:bg-gold/30">
      <div className="w-full max-w-7xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Header Section */}
        <header className="relative p-4 sm:p-6 lg:p-8 rounded-2xl glass-card border border-gold/20 overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
          <div className="absolute inset-0 bg-gradient-to-r from-gold/5 via-deep-blue/10 to-transparent pointer-events-none" />
          
          <div className="relative z-10 flex-1">
             <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white uppercase font-serif">SESSIONKING <span className="text-gold font-light">Intelligence Terminal</span></h1>
             </div>
             <p className="text-gray-400 max-w-2xl text-xs sm:text-sm italic">
               "Real-time institutional-grade forex intelligence powered by structure, liquidity, momentum, and adaptive market analysis."
             </p>
          </div>

          <div className="relative z-10 flex flex-wrap md:flex-col gap-2 sm:gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 w-fit">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-green-400 font-bold tracking-widest uppercase">AI Active</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 w-fit">
              <Wifi className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">Websocket Live</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 w-fit">
              <Cpu className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] text-purple-400 font-bold tracking-widest uppercase">Core Engine Online</span>
            </div>
          </div>
        </header>

         {/* Usage Shelf */}
         <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 sm:p-4 rounded-xl glass-card border border-white/10 shadow-sm gap-4">
           {/* Tab Navigation */}
           <div className="flex bg-black/40 p-1 rounded-xl w-full sm:w-fit border border-white/5 order-2 sm:order-1 flex-wrap gap-1">
             <button onClick={() => setActiveTab("market")} className={cn("flex-1 sm:flex-none px-3.5 sm:px-6 py-2 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-widest transition-colors", activeTab === "market" ? "bg-gold text-black shadow-md" : "text-gray-400 hover:text-white")}>
               Market Console
             </button>
             
             <button onClick={() => setActiveTab("chart")} className={cn("flex-1 sm:flex-none px-3.5 sm:px-6 py-2 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-widest transition-colors", activeTab === "chart" ? "bg-blue-500 text-white shadow-md" : "text-gray-400 hover:text-white")}>
               Chart Intelligence
             </button>
           </div>
           
           <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 text-xs font-mono order-1 sm:order-2 w-full sm:w-auto">
              {/* Detailed Credits Analytics with Progress Bar */}
              <div className="flex flex-col gap-1.5 w-full sm:w-auto sm:min-w-[220px] bg-black/40 border border-white/5 rounded-lg p-2 text-left">
                 <div className="flex justify-between items-center text-[9px] uppercase tracking-wider text-gray-400">
                    <span>Credits Info</span>
                    <span className="text-gold font-bold">{usagesRemaining} / {userProfile?.purchasedCredits || Math.max(usagesRemaining, 3)} Left</span>
                 </div>
                 
                 {/* Progress Bar */}
                 <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                       className="h-full bg-gradient-to-r from-gold to-yellow-400 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(250,204,21,0.5)]" 
                       style={{ width: `${Math.min(100, Math.max(0, (usagesRemaining / (userProfile?.purchasedCredits || Math.max(usagesRemaining, 3))) * 100))}%` }}
                    />
                 </div>

                 <div className="flex justify-between text-[8px] text-gray-500 font-mono">
                    <span>Purchased: {userProfile?.purchasedCredits || Math.max(usagesRemaining, 3)}</span>
                    <span>Used: {userProfile?.usedCredits || 0}</span>
                 </div>
              </div>

              <button 
                 onClick={initiatePurchase}
                 className="px-4 py-2.5 sm:py-2 bg-gradient-to-r from-gold/15 to-yellow-500/5 hover:from-gold/25 hover:to-yellow-500/15 rounded-lg text-[10px] font-bold uppercase tracking-widest text-gold border border-gold/30 hover:border-gold/50 transition-all whitespace-nowrap flex items-center justify-center gap-1.5 self-stretch sm:self-center min-h-[40px]"
                 disabled={loadingPayment}
              >
                {loadingPayment ? "Processing..." : "Buy Usages"}
              </button>
           </div>
         </div>

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
                   {isAdmin ? "Admin Notice: System Maintenance Active" : "Scheduled System Maintenance"}
                 </span>
                 <span className="text-[11px] opacity-80">
                   {isAdmin 
                     ? "Maintenance mode is enabled for standard users. Administrator bypass is active for diagnostics." 
                     : "The Intelligence Terminal is currently undergoing scheduled updates. Services will be restored shortly."}
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

        {/* Layout Grid */}
        {activeTab === "market" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* Left Column: Console */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* AI Analysis Console Input */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 relative overflow-hidden shadow-2xl">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <TerminalIcon className="w-32 h-32 text-gray-500" />
               </div>
               
               <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                 <TerminalIcon className="w-5 h-5 text-gold" /> Analysis Parameters
               </h2>

               <div className="space-y-5 relative z-10">
                 <div className="flex gap-4 items-end">
                   <div className="flex-1">
                     <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Pair</label>
                     <select value={pair} onChange={e => setPair(e.target.value)} className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-sm focus:border-gold outline-none text-white font-mono">
                       {activePairs.map(p => <option key={p} value={p} className="bg-black text-white">{p}</option>)}
                     </select>
                   </div>
                   <div className="bg-black/60 border border-white/10 rounded-lg p-3 flex flex-col justify-center min-w-[120px] h-[46px]">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block leading-tight mb-0.5">Live Price</span>
                      <div className="flex items-center gap-2">
                         <span className="text-white font-mono font-bold text-sm leading-none">{prices[pair] ? prices[pair].toFixed(4) : "---"}</span>
                         {directions[pair] === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
                         {directions[pair] === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
                      </div>
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Style</label>
                     <select value={style} onChange={e => setStyle(e.target.value)} className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-sm focus:border-gold outline-none text-white font-mono">
                       {STYLES.map(s => <option key={s} value={s} className="bg-black text-white">{s}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Timeframe</label>
                     <select value={timeframe} onChange={e => setTimeframe(e.target.value)} className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-sm focus:border-gold outline-none text-white font-mono">
                       {TIMEFRAMES.map(t => <option key={t} value={t} className="bg-black text-white">{t}</option>)}
                     </select>
                   </div>
                 </div>

                 <div>
                   <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Targeted Inquiry (Optional)</label>
                      <span className="text-[10px] text-gray-500 font-mono">Quick Presets:</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {[
                        "Liquidity Sweep Check",
                        "Order Block & BOS Setup",
                        "Quasimodo Reversal Level",
                        "Breakout Probability & ATR"
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setQuestion(preset)}
                          className={cn(
                            "px-2.5 py-1 text-[10px] rounded-md border transition-all font-mono",
                            question === preset 
                              ? "bg-gold/20 text-gold border-gold/40 font-bold"
                              : "bg-black/40 text-gray-400 border-white/5 hover:border-gold/30 hover:text-white"
                          )}
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                   <textarea 
                     value={question} 
                     onChange={e => setQuestion(e.target.value)}
                     placeholder="Ask SESSIONKING anything about the market..."
                     className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-gold outline-none resize-none h-24 custom-scrollbar placeholder:text-gray-600"
                   />
                 </div>

                 {!user ? (
                   <button disabled className="w-full py-4 rounded-xl bg-gradient-to-r from-gray-900 to-black border border-white/10 text-gray-500 font-bold flex flex-col items-center justify-center gap-1 shadow-lg cursor-not-allowed">
                     <Lock className="w-5 h-5" />
                     <span className="text-sm">Login Required</span>
                   </button>
                 ) : requirePayment ? (
                   <button onClick={initiatePurchase} disabled={loadingPayment} className="w-full py-4 rounded-xl bg-gradient-to-r from-gray-900 to-black border border-white/10 text-gray-300 font-bold flex flex-col items-center justify-center gap-1 hover:border-gold/30 transition shadow-lg disabled:opacity-50">
                     <Lock className="w-5 h-5 text-gold" />
                     <span className="text-sm">Payment Required</span>
                     <span className="text-[10px] text-gray-500 font-normal">Click to purchase terminal usages</span>
                   </button>
                 ) : isMaintenanceMode && !isAdmin ? (
                   <button disabled className="w-full py-4 rounded-xl bg-gradient-to-r from-gray-900 to-black border border-red-500/20 text-gray-400 font-bold flex flex-col items-center justify-center gap-1 shadow-lg cursor-not-allowed">
                     <AlertTriangle className="w-5 h-5 text-amber-500" />
                     <span className="text-sm text-amber-400">Terminal Under Maintenance</span>
                     <span className="text-[10px] text-gray-500 font-normal">Operations will resume once scheduled updates complete</span>
                   </button>
                 ) : (
                   <button 
                     onClick={handleAnalyze} 
                     disabled={isAnalyzing}
                     className="w-full relative group overflow-hidden rounded-xl border border-gold/50 bg-gradient-to-r from-gold/20 to-deep-blue/40 hover:from-gold/30 hover:to-deep-blue/50 transition-all p-4 shadow-[0_0_20px_rgba(212,175,55,0.15)] disabled:opacity-50"
                   >
                     <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
                     {isAnalyzing ? (
                       <div className="flex items-center justify-center gap-2 relative z-10">
                         <span className="text-gold font-bold tracking-widest uppercase text-sm">Processing...</span>
                       </div>
                     ) : (
                       <div className="flex items-center justify-center gap-2 relative z-10">
                         <Brain className="w-5 h-5 text-gold group-hover:scale-110 transition-transform" />
                         <span className="text-white font-bold tracking-widest uppercase text-sm group-hover:text-gold transition-colors">
                           {isMaintenanceMode && isAdmin ? "Analyze Market [Admin Override] (1 Usage)" : "Analyze Market (1 Usage)"}
                         </span>
                       </div>
                     )}
                   </button>
                 )}
                 {error && <div className="text-red-400 text-xs text-center p-2 bg-red-500/10 rounded-lg border border-red-500/20">{error}</div>}
               </div>
            </div>

            {/* Live Context / Heatmap */}
             <div className="glass-card p-6 rounded-2xl border border-white/10 shadow-lg">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Activity className="w-4 h-4 text-blue-400" /> Live Environment
               </h3>
               
               <div className="space-y-3">
                  <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5">
                    <span className="text-sm text-gray-300">Active Session</span>
                    <span className="text-sm font-bold text-gold">{currentSession}</span> 
                  </div>
                  <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5">
                     <span className="text-sm text-gray-300">{pair} Live Price</span>
                     <span className="text-sm font-bold font-mono">{prices[pair] ? prices[pair].toFixed(5) : "Syncing..."}</span>
                  </div>
                  <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5">
                     <span className="text-sm text-gray-300">Market Liq. Model</span>
                     <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded-md uppercase font-bold">Optimal</span>
                  </div>
               </div>
             </div>

          </div>

          {/* Right Column: Output */}
          <div className="lg:col-span-8">
            {!report && !isAnalyzing && (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center glass-card border border-white/5 rounded-2xl p-12 text-center relative overflow-hidden bg-gradient-to-b from-transparent to-black/40 shadow-inner">
                <Brain className="w-20 h-20 text-gold/20 mb-6 drop-shadow-2xl" />
                <h3 className="text-xl font-serif text-white mb-2 uppercase tracking-widest text-shadow-md">Systems Standing By</h3>
                <p className="text-gray-400 text-sm max-w-md leading-relaxed">
                  Configure analysis parameters in the terminal console to generate an institutional-grade probability matrix and trade scenario simulation.
                </p>
              </div>
            )}

            {isAnalyzing && (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center glass-card border border-gold/20 rounded-2xl p-12 text-center relative overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.05)]">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cyber-locks.png')] opacity-10 pointer-events-none" />
                <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  <Cpu className="w-20 h-20 text-gold drop-shadow-[0_0_30px_rgba(212,175,55,0.8)] rounded-full mb-6" />
                </motion.div>
                <h3 className="text-xl font-mono text-gold mb-4 uppercase font-bold tracking-widest">Compiling Intelligence</h3>
                <div className="space-y-3 text-left w-64 mt-4">
                  <div className="flex items-center gap-3 text-xs text-green-400 font-mono"><Sparkles className="w-4 h-4 animate-pulse"/> Sweeping Liquidity Zones...</div>
                  <div className="flex items-center gap-3 text-xs text-blue-400 font-mono"><Activity className="w-4 h-4 animate-pulse"/> Processing Momentum & EMA...</div>
                  <div className="flex items-center gap-3 text-xs text-purple-400 font-mono"><Target className="w-4 h-4 animate-pulse"/> Scoring Setups...</div>
                </div>
              </div>
            )}

            <AnimatePresence>
              {report && !isAnalyzing && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="space-y-6"
                >
                  <div className="flex justify-end mb-2">
                    <button onClick={handleShare} disabled={isSharing} className="flex items-center gap-2 px-4 py-2 bg-gold/10 hover:bg-gold/20 text-gold rounded-lg text-sm transition-colors border border-gold/20 font-bold tracking-widest uppercase shadow-sm">
                        <Share2 className="w-4 h-4" /> Share Intelligence
                    </button>
                  </div>

                  {/* Warning banner if shouldAvoid is true */}
                  {report.recommendations?.shouldAvoid && (
                    <div className="p-4 bg-red-950/40 border border-red-500/50 rounded-xl flex items-start gap-4 shadow-[0_0_30px_rgba(239,68,68,0.15)] relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/20 rounded-full blur-3xl" />
                      <ShieldAlert className="w-6 h-6 text-red-500 flex-shrink-0 mt-1 relative z-10" />
                      <div className="relative z-10">
                        <h4 className="text-red-400 font-bold uppercase tracking-widest text-sm mb-1">⚠️ Restricted Execution</h4>
                        <p className="text-sm text-gray-300">{report.recommendations.avoidReason || "High volatility or poor market structure makes trading highly risky today."}</p>
                      </div>
                    </div>
                  )}

                  {report.chatResponse && (
                    <div className="p-5 glass-card border-l-2 border-blue-500 rounded-xl bg-gradient-to-r from-deep-blue/10 to-transparent">
                      <div className="flex gap-4">
                        <TerminalIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1 block">Direct Inquiry Answer</span>
                          <p className="text-sm text-gray-100 italic leading-relaxed">"{report.chatResponse}"</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Fundamental Core */}
                    <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-5 relative overflow-hidden shadow-lg">
                      <div className="absolute -top-20 -right-20 bg-gold/5 w-64 h-64 rounded-full blur-[80px] pointer-events-none" />
                      
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
                          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" />
                          <motion.div 
                            className={cn("h-3 rounded-full relative z-10 shadow-[0_0_15px_currentColor]", report.confidenceScore > 75 ? "bg-green-500" : report.confidenceScore > 50 ? "bg-gold" : "bg-red-500")} 
                            initial={{ width: 0 }} 
                            animate={{ width: `${report.confidenceScore}%` }} 
                            transition={{ duration: 1.5, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Technical Indicators */}
                    <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-5 shadow-lg relative overflow-hidden">
                      <div className="absolute top-1/2 right-0 bg-blue-500/5 w-40 h-40 rounded-full blur-[60px] pointer-events-none" />

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

                      <div className="p-4 bg-deep-blue/20 rounded-xl border border-blue-500/20 mt-4 shadow-inner relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10"></div>
                        <div className="flex gap-3 relative z-10">
                          
                          <div>
                            <span className="text-[10px] font-bold text-gold uppercase tracking-widest mb-1 block">Trade Execution Check</span>
                            <div className="text-xs text-gray-300 space-y-1.5 font-mono">
                              <div className="flex justify-between gap-4"><strong className="text-gray-400 font-sans">Sizing:</strong> <span className="text-white text-right">{report.recommendations?.lotSizeInfo || "Standard"}</span></div>
                              <div className="flex justify-between gap-4"><strong className="text-gray-400 font-sans">Risk %:</strong> <span className="text-white text-right">{report.recommendations?.riskPercent || "1-2%"}</span></div>
                              <div className="flex justify-between gap-4"><strong className="text-gray-400 font-sans">Session:</strong> <span className="text-white text-right">{report.bestSession || currentSession}</span></div>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Scenarios */}
                  <div className="glass-card p-6 rounded-2xl border border-white/10 shadow-lg">
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
                        <span className="text-gold font-bold uppercase text-[10px] tracking-widest block mb-2 relative z-10">Alternative</span>
                        <p className="text-sm text-gray-200 leading-relaxed relative z-10">{report.alternativeScenario}</p>
                      </div>
                      <div className="p-5 bg-gradient-to-b from-red-500/10 to-transparent border-t-2 border-red-500 rounded-b-xl shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-5"><ShieldAlert className="w-16 h-16"/></div>
                        <span className="text-red-400 font-bold uppercase text-[10px] tracking-widest block mb-2 relative z-10">Invalidation</span>
                        <p className="text-sm text-gray-200 leading-relaxed relative z-10">{report.invalidation}</p>
                      </div>
                    </div>
                  </div>

                  {/* Educational Explanation */}
                  <div className="p-6 bg-gradient-to-r from-deep-blue/30 to-black/20 border border-blue-500/20 rounded-2xl relative overflow-hidden shadow-[0_0_30px_rgba(0,31,63,0.3)]">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
                       <Brain className="w-48 h-48 text-blue-500" />
                    </div>
                    <div className="flex gap-4 relative z-10">
                      <Brain className="w-6 h-6 text-blue-400 flex-shrink-0" />
                      <div>
                        <h4 className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-3">SESSIONKING's Educational Insights</h4>
                        <p className="text-sm text-gray-300 leading-relaxed max-w-4xl px-2 py-1 typing-effect">
                          {report.explanation}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Live Chart View */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div className="glass-card p-6 rounded-2xl border border-white/10 shadow-lg relative min-h-[480px] flex flex-col">
                      <h3 className="text-xs font-bold text-gold uppercase tracking-widest flex items-center gap-2 mb-4 shrink-0">
                        <Target className="w-4 h-4" /> Live Technical Data
                      </h3>
                      <div className="flex-1 min-h-[380px]">
                        <LiveAnalysisChart pair={pair} bias={report.bias as any} technicalLevels={report.technicalLevels} />
                      </div>
                    </div>
                    {report.fundamentalScores && (
                      <div className="glass-card p-6 rounded-2xl border border-white/10 shadow-lg relative min-h-[480px] flex flex-col">
                        <h3 className="text-xs font-bold text-gold uppercase tracking-widest flex items-center gap-2 mb-4 shrink-0">
                          <Activity className="w-4 h-4" /> Fundamental Context
                        </h3>
                        <div className="flex-1 min-h-[380px]">
                          <FundamentalAnalysisChart scores={report.fundamentalScores} />
                        </div>
                      </div>
                    )}
                  </div>

                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
        ) : (
          <ChartIntelligenceEngine 
            user={user} 
            userProfile={userProfile} 
            usagesRemaining={usagesRemaining}
            onProceedToPayment={onProceedToPayment} 
          />
        )}

      </div>
      
      <style>{`
        .typing-effect {
          border-right: 2px solid rgba(212, 175, 55, 0.7);
          animation: blink 0.7s step-end infinite;
          display: inline-block;
        }
        @keyframes blink {
          50% { border-color: transparent; }
        }
      `}</style>

      {showExhaustedModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-matte-black border border-gold/30 rounded-2xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(212,175,55,0.15)] relative">
            <button 
              onClick={() => setShowExhaustedModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex justify-center mb-4">
              <Lock className="w-10 h-10 text-gold" />
            </div>
            <h2 className="text-2xl font-bold text-center text-white mb-3 uppercase tracking-wider">Access Required</h2>
            <p className="text-gray-400 text-center text-sm mb-6 leading-relaxed">
              You have exhausted your Intelligence Terminal credits. Purchase an access pass to unlock institutional-grade AI market & chart analysis.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowExhaustedModal(false)} 
                className="flex-1 py-3 px-4 rounded-xl border border-white/20 text-white font-bold hover:bg-white/5 transition-colors text-sm"
              >
                Dismiss
              </button>
              <button 
                onClick={() => {
                  setShowExhaustedModal(false);
                  initiatePurchase();
                }}
                disabled={loadingPayment}
                className="flex-1 py-3 px-4 rounded-xl bg-gold text-black font-bold hover:bg-yellow-500 transition-colors disabled:opacity-50 text-sm shadow-md"
              >
                {loadingPayment ? "Processing..." : "Buy Usages"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
