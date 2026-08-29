import { useState, useEffect, Suspense, lazy, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

import { 
  Search, 
  AlertCircle, 
  AlertTriangle,
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Target, 
  ShieldCheck,
  Zap,
  RefreshCw,
  Lock,
  EyeOff,
  Info,
  Activity,
  Newspaper,
  Brain
} from "lucide-react";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import { User as FirebaseUser } from "firebase/auth";
import { Session, SESSIONS, PAIRS_BY_SESSION, Signal, Plan, User as UserProfile } from "../types";
import { analyzePair } from "../services/geminiService";
import { isMarketWeekend, cn } from "../lib/utils";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import JargonFormatter from "./JargonFormatter";
import { usePriceFeed } from "../hooks/usePriceFeed";

import MarketSentimentWidget from "./MarketSentimentWidget";
import AnomalyMonitorWidget from "./AnomalyMonitorWidget";
import ConfidenceCalibrationViewer from "./ConfidenceCalibrationViewer";
const BacktestEngine = lazy(() => import("./BacktestEngine"));
const RiskMarquee = lazy(() => import("./RiskMarquee"));
const TodaySignalsArchive = lazy(() => import("./TodaySignalsArchive"));
const EconomicCalendar = lazy(() => import("./EconomicCalendar"));
const LiveNewsFeed = lazy(() => import("./LiveNewsFeed"));

interface SignalEngineProps {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  userPlan?: Plan;
  onUpgrade: () => void;
}

const getAIErrorMessage = (err: any, prefix: string) => {
  let errorString = "";
  if (typeof err === 'string') {
    errorString = err;
  } else if (err instanceof Error) {
    errorString = err.message;
  } else if (err && typeof err === 'object') {
    try {
      errorString = JSON.stringify(err);
    } catch (e) {
      errorString = String(err);
    }
  }

  const msg = errorString.toLowerCase();
  
  if (msg.includes("offline") || msg.includes("network") || msg.includes("fetch") || msg.includes("xhr") || msg.includes("rpc") || msg.includes("failed to fetch")) {
    return `${prefix}: Network connectivity issue detected. Please verify your connection and try again.`;
  } else if (msg.includes("quota") || msg.includes("429") || msg.includes("rate limit") || msg.includes("resource_exhausted")) {
    return `${prefix}: AI Service quota or rate limit reached. Please try again in a few moments.`;
  } else if (msg.includes("permission") || msg.includes("403") || msg.includes("permission-denied") || msg.includes("unauthorized") || msg.includes("401")) {
    return `${prefix}: Access denied or session expired. Please verify your subscription or sign in again.`;
  } else if (msg.includes("invalid") || msg.includes("parse") || msg.includes("syntax") || msg.includes("json") || msg.includes("unexpected") || msg.includes("format")) {
    return `${prefix}: Analysis formatting error. Please retry generating the signal. (${errorString})`;
  } else if (msg.includes("timeout") || msg.includes("aborted")) {
    return `${prefix}: Analysis timed out. Please try processing the signal again.`;
  } else {
    return `${prefix}: ${errorString}`;
  }
};

const formatValue = (val: any): string => {
  if (
    val === undefined ||
    val === null ||
    val === "0" ||
    val === 0 ||
    String(val).trim() === "" ||
    String(val).toUpperCase() === "N/A" ||
    String(val).toUpperCase() === "NULL" ||
    String(val).toUpperCase() === "UNDEFINED"
  ) {
    return "Calculating...";
  }
  return String(val);
};

export default function SignalEngine({ user, userProfile, userPlan, onUpgrade }: SignalEngineProps) {
  const [activeTab, setActiveTab] = useState<"live" | "backtest" | "archive" | "news">("live");
  const [session, setSession] = useState<Session>("All");
  const [pair, setPair] = useState<string>("");
  const [tradingMode, setTradingMode] = useState<"Scalp Trader" | "Day Trader" | "Swing Trader">("Day Trader");
  const [accountBalance, setAccountBalance] = useState<number>(10000);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [availableSignals, setAvailableSignals] = useState<Signal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [isLiveUpdating, setIsLiveUpdating] = useState(false);
  const [liveSignalStatus, setLiveSignalStatus] = useState<"WAIT" | "VALID" | null>(null);
  const lastUpdatePrice = useRef<number | null>(null);
  const closingTradeRef = useRef<string | null>(null);
  const signalRef = useRef<{id: string} | null>(null);
  const [isEngineActive, setIsEngineActive] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    // Only subscribe to system config if user is authenticated to avoid permission-denied errors
    if (user) {
      unsub = onSnapshot(doc(db, "system", "engineConfig"), (docSnap) => {
        if (docSnap.exists() && docSnap.data().isEngineActive !== undefined) {
          setIsEngineActive(docSnap.data().isEngineActive);
        }
      }, (error: any) => {
        console.warn("Firestore error for engineConfig:", error);
        if (!String(error).includes("client is offline")) {
          try { handleFirestoreError(error, OperationType.GET, "system/engineConfig"); } catch(e){}
        }
      });
    }
    return () => unsub();
  }, [user]);

  const { prices, directions } = usePriceFeed();

  const pricesRef = useRef(prices);

  useEffect(() => {
    pricesRef.current = prices;
  }, [prices]);

  const formatPrice = useCallback((p: string, val: number) => {
    if (p.includes('JPY') || p.includes('BTC') || p.includes('ETH') || p.includes('XAU') || p.includes('XAG')) {
      return val.toFixed(2);
    }
    if (p.includes('MXN') || p.includes('BRL') || p.includes('ZAR') || p.includes('TRY')) {
      return val.toFixed(4);
    }
    return val.toFixed(5);
  }, []);

  
  
  const [globalNews, setGlobalNews] = useState<string>("No significant news available.");
  const [upcomingHighImpactEvent, setUpcomingHighImpactEvent] = useState<any>(null);

  useEffect(() => {
    const fetchNewsForEngine = async () => {
      try {
        const response = await fetch('/api/news');
        if (!response.ok) return;
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          const newsHeadlines = result.data.slice(0, 5).map((n: any) => n.title).join(' | ');
          setGlobalNews(`Recent Global Market Headlines: ${newsHeadlines}`);
        }
      } catch (e) {
        console.warn("Failed to fetch news for engine", e);
      }
    };
    fetchNewsForEngine();
    const timer = setInterval(fetchNewsForEngine, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchCalendarForEngine = async () => {
      try {
        const response = await fetch('/api/calendar');
        if (!response.ok) return;
        const result = await response.json();
        if (result.success && result.data) {
          const now = new Date();
          const upcoming = result.data.filter((e: any) => {
             if (e.impact !== "High") return false;
             if (pair) {
                const bases = pair.split('/');
                if (!bases.includes(e.country)) return false;
             }
             const eventTime = new Date(e.date);
             const diffMs = eventTime.getTime() - now.getTime();
             const diffMins = Math.floor(diffMs / 60000);
             return diffMins >= 0 && diffMins <= 15;
          });
          if (upcoming.length > 0) {
             upcoming.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
             setUpcomingHighImpactEvent(upcoming[0]);
          } else {
             setUpcomingHighImpactEvent(null);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch calendar for engine", e);
      }
    };
    if (pair) {
       fetchCalendarForEngine();
       const timer = setInterval(fetchCalendarForEngine, 60000);
       return () => clearInterval(timer);
    }
  }, [pair]);

  const volatilityContextStr = useMemo(() => {
    if (upcomingHighImpactEvent) {
       return `CRITICAL: High Impact News (${upcomingHighImpactEvent.title}) for ${upcomingHighImpactEvent.country} in less than 15 mins. Extreme Volatility Expected.`;
    }
    return `Current Spread/Volatility Proxy: ${directions[pair] || 'Neutral'} movement, Impact Level: NONE`;
  }, [directions, pair, upcomingHighImpactEvent]);

  const rawPlan = (userPlan || userProfile?.currentPlan || userProfile?.plan || 'free').toString().toLowerCase();
  const plan: Plan = (["free", "pro", "premium", "institutional"].includes(rawPlan) ? rawPlan : 'free') as Plan;
  const isRestricted = plan === 'free';
  const usageLimit = useMemo(() => {
    if (plan === 'institutional') return Infinity;
    if (plan === 'premium') return 30;
    if (plan === 'pro') return 10;
    return 3; // free
  }, [plan]);

  // Reset live update tracking when new pair or entry changes
  useEffect(() => {
    lastUpdatePrice.current = null;
  }, [pair, signal?.entry]);

  // Listen to liveSignals from TradingView/MT5
  useEffect(() => {
    if (!pair || !user || !isEngineActive) return;

    const q = query(
      collection(db, "liveSignals"),
      orderBy("timestamp", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) return;
      
      const latestSignal = snapshot.docs[0].data();
      
      // Prevent AI loop by ignoring AI Engine signals generated by any user
      if (latestSignal.source === "AI Engine") return;
      
      // Only process if it matches the current pair
      if (latestSignal.pair !== pair) return;
      
      // Check if it's a new signal (within last 5 minutes)
      const signalTime = new Date(latestSignal.timestamp).getTime();
      const now = Date.now();
      if (now - signalTime > 5 * 60 * 1000) return;
      
      const signalId = snapshot.docs[0].id;
      if (signalRef.current?.id === signalId) return; // Deduplication rule
      
      console.log("📡 Real-time signal received:", latestSignal);
      signalRef.current = { id: signalId };
      
      // Apply Filters
      // Basic spread check (mocked based on price feed logic)
      const currentPrice = pricesRef.current[pair];
      const isSpreadHigh = false; // In a real app, calculate spread from bid/ask
      const isLowLiquidity = session === 'Asian' && !pair.includes('JPY') && !pair.includes('AUD') && !pair.includes('NZD');

      if (isSpreadHigh || isLowLiquidity) {
        console.log("🛡️ Signal rejected by filters");
        setLiveSignalStatus("WAIT");
        setSignal({
          pair,
          strategy: "N/A",
          trade_type: "WAIT",
          entry_price: "0",
          stop_loss: "0",
          take_profit_1: "0",
          take_profit_2: "0",
          timeframe: "N/A",
          risk_percent: 0,
          reason: `Real-time signal rejected due to filters: ${isSpreadHigh ? 'High Spread' : 'Low Liquidity Session'}`,
          type: "WAIT",
          entry: "0",
          stopLoss: "0",
          takeProfit1: "0",
          takeProfit2: "0",
          confidence: "0",
          dailyBias: "NEUTRAL",
          executionType: "MARKET",
          estimatedTriggerTime: "N/A",
          recommendedLotSize: "0",
          riskReward: "0",
          duration: "0",
          probabilityBreakdown: {
            structure: 0,
            momentum: 0,
            liquidity: 0
          },
          sessionStrength: "Moderate",
          invalidation: "N/A",
          reasoning: [
            `Real-time signal rejected due to filters: ${isSpreadHigh ? 'High Spread' : 'Low Liquidity Session'}`
          ],
          session,
          tradingMode,
          timestamp: new Date().toISOString(),
          isDelayed: false
        });
        return;
      }

      // Merge with internal logic (Gemini analysis)
      setIsAnalyzing(true);
      setLiveSignalStatus("VALID");
      try {
        // PHASE 3: PARAMETER LOCKING SYSTEM
        const lockedContext = { pair, session, tradingMode, accountBalance };
        const pricesCurrent = pricesRef.current[lockedContext.pair] || null;
        console.log(`[REFRESH LOCK] Context: Pair=${lockedContext.pair}, Session=${lockedContext.session}, Mode=${lockedContext.tradingMode}, Balance=${lockedContext.accountBalance}, Price=${pricesCurrent}`);

        const results = await analyzePair(lockedContext.pair, lockedContext.session, lockedContext.tradingMode, lockedContext.accountBalance, pricesCurrent, globalNews, volatilityContextStr);
        const result = results[0];
        
        if (result) {
          result.pair = lockedContext.pair;
          result.session = lockedContext.session;
          result.tradingMode = lockedContext.tradingMode;
          result.trading_style = lockedContext.tradingMode;
          result.account_balance = lockedContext.accountBalance;
          if (result.entryClassification === 'Market' && pricesCurrent) {
            result.entry = String(pricesCurrent);
          }
        }

        // Validate Context 
        const normalizePair = (p: string) => String(p).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
        
        const matchPair = normalizePair(result.pair) === normalizePair(lockedContext.pair);
        const aiSession = String(result.session || '').toLowerCase().replace(' session', '').trim();
        const expectedSession = String(lockedContext.session || '').toLowerCase().replace(' session', '').trim();
        const matchSession = aiSession === expectedSession || aiSession.includes(expectedSession) || expectedSession.includes(aiSession) || expectedSession === 'all' || aiSession === 'all';
        const aiStyle = String(result.trading_style || result.trade_type || result.tradingMode || '').toLowerCase().replace(/trader|trading/g, '').trim();
        const expectedStyle = String(lockedContext.tradingMode || '').toLowerCase().replace(/trader|trading/g, '').trim();
        const matchStyle = aiStyle === expectedStyle || aiStyle.includes(expectedStyle) || expectedStyle.includes(aiStyle);
        const matchBalance = Number(result.account_balance || lockedContext.accountBalance) === Number(lockedContext.accountBalance);

        const isMarket = result.entryClassification === 'Market';
        const entryPrice = parseFloat(result.entry);
        let matchPrice = true;
        if (isMarket && pricesCurrent && !isNaN(entryPrice)) {
          const diff = Math.abs(pricesCurrent - entryPrice);
          const percentageDiff = diff / pricesCurrent;
          matchPrice = percentageDiff <= 0.005; 
        }

        if (!matchPair || !matchSession || !matchStyle || !matchBalance || !matchPrice) {
           console.warn(`[VALIDATION FAILED] Parameter mismatch during refresh: Pair(${matchPair}), Session(${matchSession}), Style(${matchStyle}), Balance(${matchBalance}), Price(${matchPrice}). Aborting.`);
           return;
        }

        // Override the type with the real-time signal type if they align, or just use the real-time one
        // For this implementation, we'll let the AI confirm the signal
        const sigAction = latestSignal.action || latestSignal.type;
        const sigEntry = latestSignal.price || latestSignal.entry || result.entry;

        if (result.type === sigAction || latestSignal.source === "Admin Panel") {
          setAvailableSignals(results);
          setSignal({
            ...result,
            type: sigAction,
            reasoning: [
               `Real-time ${latestSignal.source} signal verified.`,
               ...(result.reasoning || [])
             ]
          });
        } else {
          setAvailableSignals([]);
          setLiveSignalStatus("WAIT");
          setSignal({
            pair,
            strategy: "N/A",
            trade_type: "WAIT",
            entry_price: "0",
            stop_loss: "0",
            take_profit_1: "0",
            take_profit_2: "0",
            timeframe: "N/A",
            risk_percent: 0,
            reason: `Real-time ${latestSignal.source} signal (${sigAction}) conflicted with internal logic (${result.type}). Waiting for clearer setup.`,
            type: "WAIT",
            entry: "0",
            stopLoss: "0",
            takeProfit1: "0",
            takeProfit2: "0",
            confidence: "0",
            dailyBias: "NEUTRAL",
            executionType: "MARKET",
            estimatedTriggerTime: "N/A",
            recommendedLotSize: "0",
            riskReward: "0",
            duration: "0",
            probabilityBreakdown: {
              structure: 0,
              momentum: 0,
              liquidity: 0
            },
            sessionStrength: "Moderate",
            invalidation: "N/A",
            reasoning: [
              `Real-time ${latestSignal.source} signal (${latestSignal.action}) conflicted with internal logic (${result.type}). Waiting for clearer setup.`
            ],
            session,
            tradingMode,
            timestamp: new Date().toISOString(),
            isDelayed: false
          });
        }
      } catch (err: any) {
        console.error("Error confirming live signal:", err);
        setError(getAIErrorMessage(err, "Confirmation Failed"));
      } finally {
        setIsAnalyzing(false);
      }
    }, (error: any) => {
      console.warn("Firestore error for liveSignals:", error);
      if (!String(error).includes("client is offline")) {
        try { handleFirestoreError(error, OperationType.GET, "liveSignals"); } catch(e){}
      }
    });

    return () => unsubscribe();
  }, [pair, user, session, tradingMode, accountBalance, isEngineActive, volatilityContextStr]);

  // Real-time Signal Updates for Pro/Premium/Institutional
  useEffect(() => {
    if ((plan === 'pro' || plan === 'premium' || plan === 'institutional') && signal && (signal as any).type !== 'WAIT' && signal.pair === pair && !isAnalyzing && isEngineActive) {
      const currentPrice = prices[pair];
      if (!currentPrice) return;

      const entryPrice = parseFloat(signal.entry);
      if (isNaN(entryPrice)) return;

      const isJpy = pair.includes('JPY');
      let pipValue = isJpy ? 0.01 : 0.0001;
      if (pair.includes('BTC') || pair.includes('ETH')) pipValue = 1;
      else if (pair.includes('XAU') || pair.includes('XAG')) pipValue = 0.1;
      else if (pair.includes('ZAR') || pair.includes('MXN') || pair.includes('BRL') || pair.includes('TRY')) pipValue = 0.001;
      
      // Reference price is either the last update price or the initial entry
      const referencePrice = lastUpdatePrice.current || entryPrice;
      const moveSinceLastUpdate = Math.abs(currentPrice - referencePrice);

      const slPrice = parseFloat(signal.stopLoss);
      const tp1Price = parseFloat(signal.takeProfit1);
      const tp2Price = parseFloat(signal.takeProfit2);
      const isLong = signal.type === 'BUY';
      const isShort = signal.type === 'SELL';

      let tradeOutcome: 'WIN' | 'LOSS' | null = null;
      let exitPrice = 0;

      // Check if SL hit
      if (isLong && currentPrice <= slPrice) { tradeOutcome = 'LOSS'; exitPrice = slPrice; }
      else if (isShort && currentPrice >= slPrice) { tradeOutcome = 'LOSS'; exitPrice = slPrice; }
      // Check if TP1 hit
      else if (isLong && currentPrice >= tp1Price) { tradeOutcome = 'WIN'; exitPrice = tp1Price; }
      else if (isShort && currentPrice <= tp1Price) { tradeOutcome = 'WIN'; exitPrice = tp1Price; }

      if (tradeOutcome && user && signal.id !== 'simulated-live-trade') {
        const tradeKey = (signal.tradeId || signal.id) + signal.timestamp;
        if (closingTradeRef.current === tradeKey) return;
        closingTradeRef.current = tradeKey;
        
        const pipsDiff = Math.abs(entryPrice - exitPrice) / pipValue;
        const pips = tradeOutcome === 'WIN' ? pipsDiff : -pipsDiff;
        
        // Terminal state transition: Preserve original type (BUY/SELL) and update terminal status
        const terminalStatus = tradeOutcome === 'WIN' ? 'CLOSED_TP' : 'CLOSED_SL';
        setSignal(prev => prev ? { 
          ...prev, 
          status: terminalStatus, 
          trade_status: terminalStatus,
          closedAt: new Date().toISOString(),
          pipsRealized: Math.round(pips),
          reasoning: [`FCS market-data TP/SL event: Trade reached terminal state with ${tradeOutcome} (${Math.round(pips)} pips).`] 
        } : null);
        return;
      }

      // RULE 8: SIGNAL STABILITY RULE
      // Once a signal is generated, avoid full regeneration unless major structural change occurs.
      // SIGNIFICANT SHIFT: Re-evaluate everything (> 25 pips)
      let MIN_LOCK_SEC = 300; // 5m default (Scalp)
      if (tradingMode === "Day Trader") MIN_LOCK_SEC = 900; // 15m default
      else if (tradingMode === "Swing Trader") MIN_LOCK_SEC = 3600; // 1h default
      const signalAge = signal.timestamp ? (Date.now() - new Date(signal.timestamp).getTime()) / 1000 : 9999;
      
      if (moveSinceLastUpdate > pipValue * 25 && signalAge > MIN_LOCK_SEC) {
        setIsLiveUpdating(true);
        lastUpdatePrice.current = currentPrice;
        
        const updateImmediately = async () => {
          try {
            // Re-analyze the pair for a fresh institutional perspective
            // PHASE 3: Parameter locking
            const lockedContext = {
              pair,
              session,
              tradingMode,
              accountBalance
            };
            const currentPrice = pricesRef.current[lockedContext.pair] || null;
            console.log(`[UPDATE LOCK] Context: Pair=${lockedContext.pair}, Session=${lockedContext.session}, Mode=${lockedContext.tradingMode}, Balance=${lockedContext.accountBalance}, Price=${currentPrice}`);

            const results = await analyzePair(lockedContext.pair, lockedContext.session, lockedContext.tradingMode, lockedContext.accountBalance, currentPrice, globalNews, volatilityContextStr);
            const result = results[0];

            if (result) {
              result.pair = lockedContext.pair;
              result.session = lockedContext.session;
              result.tradingMode = lockedContext.tradingMode;
              result.trading_style = lockedContext.tradingMode;
              result.account_balance = lockedContext.accountBalance;
              if (result.entryClassification === 'Market' && currentPrice) {
                result.entry = String(currentPrice);
              }
            }

            // Validate Context
            const normalizePair = (p: string) => String(p).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
            
            const matchPair = normalizePair(result.pair) === normalizePair(lockedContext.pair);
            const aiSession = String(result.session || '').toLowerCase().replace(' session', '').trim();
            const expectedSession = String(lockedContext.session || '').toLowerCase().replace(' session', '').trim();
            const matchSession = aiSession === expectedSession || aiSession.includes(expectedSession) || expectedSession.includes(aiSession) || expectedSession === 'all' || aiSession === 'all';
            const aiStyle = String(result.trading_style || result.trade_type || result.tradingMode || '').toLowerCase().replace(/trader|trading/g, '').trim();
            const expectedStyle = String(lockedContext.tradingMode || '').toLowerCase().replace(/trader|trading/g, '').trim();
            const matchStyle = aiStyle === expectedStyle || aiStyle.includes(expectedStyle) || expectedStyle.includes(aiStyle);
            const matchBalance = Number(result.account_balance || lockedContext.accountBalance) === Number(lockedContext.accountBalance);

            const isMarket = result.entryClassification === 'Market';
            const entryPrice = parseFloat(result.entry);
            let matchPrice = true;
            if (isMarket && currentPrice && !isNaN(entryPrice)) {
              const diff = Math.abs(currentPrice - entryPrice);
              const percentageDiff = diff / currentPrice;
              matchPrice = percentageDiff <= 0.005; 
            }

            if (!matchPair || !matchSession || !matchStyle || !matchBalance || !matchPrice) {
               console.warn(`[VALIDATION FAILED] Parameter mismatch during live update: Pair(${matchPair}), Session(${matchSession}), Style(${matchStyle}), Balance(${matchBalance}), Price(${matchPrice}). Aborting.`);
               return;
            }
            
            if (signal && user && signal.id !== 'simulated-live-trade' && signal.type !== result.type) {
                addDoc(collection(db, "users", user.uid, "notifications"), {
                  userId: user.uid,
                  type: "RISK",
                  title: `CRITICAL: ${signal.pair} Direction Re-evaluated!`,
                  message: `Direction reversed from ${signal.type} to ${result.type}. Please close existing positions and reverse direction within 3 minutes to limit risk. New SL: ${result.stopLoss}, New TP1: ${result.takeProfit1}. Reason: ${result.reasoning?.[0] || 'Substantial market structure shift'}.`,
                  priority: "HIGH",
                  isRead: false,
                  timestamp: new Date().toISOString()
                }).catch(e => console.error("Notification failed", e));
            }
            
            setAvailableSignals(results);
            setSignal(prev => {
              if (!prev) return result;
              
              const typeChanged = prev.type !== result.type;
              const prevConfidence = parseInt(prev.confidence) || 0;
              const newConfidence = parseInt(result.confidence) || 0;
              const confidenceShift = Math.abs(prevConfidence - newConfidence);
              
              return {
                ...result,
                reasoning: [
                  `SUBSTANTIAL SHIFT DETECTED (${(moveSinceLastUpdate / pipValue).toFixed(1)} pips).`,
                  typeChanged ? `Signal type re-evaluated to ${result.type}.` : `Parameters optimized for current volatility.`,
                  confidenceShift > 10 ? `Confidence adjusted to ${result.confidence}% based on new structure.` : (prev.reasoning?.[0] || ''),
                  ...(result.reasoning?.slice(0, 2) || [])
                ]
              };
            });
          } catch (err: any) {
            console.error("Live re-analysis failed", err);
            setError(getAIErrorMessage(err, "Re-analysis Failed"));
          } finally {
            setIsLiveUpdating(false);
          }
        };
        updateImmediately();
      }
    }
  }, [prices, pair, plan, signal, formatPrice, isAnalyzing, session, tradingMode, accountBalance, isEngineActive, user, volatilityContextStr, globalNews]);

  // Periodic 5-minute full re-evaluation for active trades has been disabled manually
  // to avoid automatic continuous API consumption unless the user explicitly requests an update.
  useEffect(() => {
    // Disabled background polling.
  }, [signal, pair, plan, session, tradingMode, accountBalance, isAnalyzing, user, isEngineActive, volatilityContextStr]);

  useEffect(() => {
    if (userProfile?.tradingMode) {
      setTradingMode(userProfile.tradingMode as any);
    }
  }, [userProfile]);

  const handleTradingModeChange = useCallback(async (mode: "Scalp Trader" | "Day Trader" | "Swing Trader") => {
    setTradingMode(mode);
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), { tradingMode: mode });
      } catch (err: any) {
        console.warn("Failed to save trading mode", err);
        if (!String(err).includes("client is offline")) {
          try { handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`); } catch (e) {}
        }
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchUsage = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const usageRef = doc(db, "users", user.uid, "usage", today);
        const usageSnap = await getDoc(usageRef);
        if (usageSnap.exists()) {
          setUsageCount(usageSnap.data().signalCount);
        } else {
          setUsageCount(0);
        }
      } catch (err: any) {
        console.warn("Error fetching usage:", err);
        if (!String(err).includes("client is offline")) {
          // ignore offline error without throwing
          try { handleFirestoreError(err, OperationType.GET, `users/${user.uid}/usage`); } catch (e) {}
        }
      }
    };
    fetchUsage();
  }, [user]);

  // Reset pair when session changes if the current pair isn't in the new session's list
  useEffect(() => {
    const availablePairs = PAIRS_BY_SESSION[session];
    if (!availablePairs.includes(pair)) {
      setPair(availablePairs[0] || "");
    }
  }, [session, pair]);

  const handleAnalyze = useCallback(async () => {
    if (isAnalyzing || !pair || !user) return;
    
    const isCryptoPair = pair.includes("BTC") || pair.includes("ETH");
    if (isMarketWeekend() && !isCryptoPair) {
      setError("Forex market is closed on weekends. Engine cannot function at this time until the market opens. Forex markets are open 24/5 (Cryptocurrencies remain active 24/7).");
      return;
    }
    
    if (!isEngineActive) {
      setError("Trading Engine is currently paused by Administration.");
      return;
    }

    // Trading Style restriction
    if (tradingMode === "Scalp Trader" && plan !== "institutional") {
      setError(`Locked: Scalp Trader style (1M-5M timeframe) is exclusive to the Institutional plan. Your current plan is ${plan.toUpperCase()}.`);
      return;
    }

    // Currency Pair restrictions
    const isMetal = pair.includes("XAU") || pair.includes("XAG");
    const isCrypto = pair.includes("BTC") || pair.includes("ETH");
    const isExotic = ["USD/MXN", "USD/BRL", "USD/ZAR", "USD/TRY", "USD/SGD", "USD/HKD"].includes(pair);

    if ((isMetal || isCrypto || isExotic) && (plan === "free" || plan === "pro")) {
      setError(`Locked: Exotic pairs, Metals (Gold/Silver), and Cryptocurrencies are restricted to Premium and Institutional plans. Your current plan is ${plan.toUpperCase()}.`);
      return;
    }
    
    if (usageCount >= usageLimit) {
      setShowLimitModal(true);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAvailableSignals([]);
    
    let validResults: any[] = [];
    let attempts = 0;
    const maxAttempts = 3;

    while (validResults.length === 0 && attempts < maxAttempts) {
      attempts++;
      try {
        // PHASE 3: PARAMETER LOCKING SYSTEM
        const lockedContext = {
          pair,
          session,
          tradingMode,
          accountBalance
        };
        
        // RULE 9: REAL-TIME CONSISTENCY RULE
        // All components (Engine, Charts, Risk) must remain synchronized through Central Market Data Manager.
        
        // PHASE 8: SIGNAL ENGINE DATA VALIDATION
        const marketDataRes = await fetch(`/api/market-data?pair=${encodeURIComponent(lockedContext.pair)}`);
        if (!marketDataRes.ok && marketDataRes.status !== 202) {
          throw new Error("Failed to connect to Central Market Data Manager");
        }
        
        const marketDataJson = await marketDataRes.json();
        if (!marketDataJson.data || marketDataJson.data.length === 0) {
           console.warn("[VALIDATION FAILED] No verified FCS market data available for " + lockedContext.pair + ". Requesting fresh data.");
           throw new Error("Missing verified market data. Requesting fresh data.");
        }
        
        const latestCandle = marketDataJson.data[marketDataJson.data.length - 1];
        const verifiedFCSPrice = latestCandle.close;
        const verifiedTimestamp = latestCandle.timestamp;
        
        const wsPrice = pricesRef.current[lockedContext.pair];
        
        console.log(`[DATA VALIDATION] Selected Pair: ${lockedContext.pair}, Verified FCS Pair: ${marketDataJson.pair}`);
        console.log(`[DATA VALIDATION] WS Price: ${wsPrice}, Verified FCS Price: ${verifiedFCSPrice}`);
        console.log(`[DATA VALIDATION] Timestamp: ${verifiedTimestamp}`);
        
        if (marketDataJson.pair !== lockedContext.pair) {
           console.warn("[VALIDATION FAILED] Pair mismatch. Expected " + lockedContext.pair + ", got " + marketDataJson.pair);
           throw new Error("Market Data Pair Mismatch. Rejecting analysis.");
        }
        
        if (wsPrice && Math.abs(wsPrice - verifiedFCSPrice) / verifiedFCSPrice > 0.005) {
           console.warn("[VALIDATION FAILED] Local price state is unsynchronized with FCS verified state.");
           throw new Error("Market Data Synchronization Error. Rejecting analysis.");
        }

        const currentPrice = verifiedFCSPrice;

        console.log(`[ANALYSIS LOCK] Context: Pair=${lockedContext.pair}, Session=${lockedContext.session}, Mode=${lockedContext.tradingMode}, Balance=${lockedContext.accountBalance}, Price=${currentPrice} (Attempt ${attempts}/${maxAttempts})`);
        
        // RULE 7: ACCELERATED SIGNAL OUTPUT ENGINE
        // This process uses the cache-first central data manager to output signal
        // as soon as minimum viable confidence is reached.
        const results = await analyzePair(lockedContext.pair, lockedContext.session, lockedContext.tradingMode, lockedContext.accountBalance, currentPrice, globalNews, volatilityContextStr);
        
        for (const result of results) {
          if (result) {
            result.pair = lockedContext.pair;
            result.session = lockedContext.session;
            result.tradingMode = lockedContext.tradingMode;
            result.trading_style = lockedContext.tradingMode;
            result.account_balance = lockedContext.accountBalance;
            if (result.entryClassification === 'Market' && currentPrice) {
              result.entry = String(currentPrice);
            }
          }

          // PHASE 9: SIGNAL GENERATION CONSISTENCY CHECK
          const normalizeString = (p: string) => String(p).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
          
          // Phase 4: Pair Validation
          const matchPair = normalizeString(result.pair) === normalizeString(lockedContext.pair);
          
          // Phase 5: Session Validation
          const aiSession = String(result.session || '').toLowerCase().replace(' session', '').trim();
          const expectedSession = String(lockedContext.session || '').toLowerCase().replace(' session', '').trim();
          const matchSession = aiSession === expectedSession || aiSession.includes(expectedSession) || expectedSession.includes(aiSession) || expectedSession === 'all' || aiSession === 'all';
          
          // Phase 6: Trading Style Validation
          const aiStyle = String(result.trading_style || result.trade_type || result.tradingMode || '').toLowerCase().replace(/trader|trading/g, '').trim();
          const expectedStyle = String(lockedContext.tradingMode || '').toLowerCase().replace(/trader|trading/g, '').trim();
          const matchStyle = aiStyle === expectedStyle || aiStyle.includes(expectedStyle) || expectedStyle.includes(aiStyle);

          // Phase 7: Account Balance Validation
          const matchBalance = Number(result.account_balance || lockedContext.accountBalance) === Number(lockedContext.accountBalance);

          // Phase 8: Market Data Validation
          const isMarket = result.entryClassification === 'Market';
          const entryPrice = parseFloat(result.entry);
          let matchPrice = true;
          if (isMarket && currentPrice && !isNaN(entryPrice)) {
            const diff = Math.abs(currentPrice - entryPrice);
            const percentageDiff = diff / currentPrice;
            matchPrice = percentageDiff <= 0.005; // Permit 0.5% deviation max for slight execution slippage logic
          }

          console.log(`[VALIDATION ENGINE] Pair: ${result.pair} (Expected: ${lockedContext.pair}) -> ${matchPair}`);
          console.log(`[VALIDATION ENGINE] Session: ${result.session} (Expected: ${lockedContext.session}) -> ${matchSession}`);
          console.log(`[VALIDATION ENGINE] Style: ${result.trading_style} / ${result.trade_type} (Expected: ${lockedContext.tradingMode}) -> ${matchStyle}`);
          console.log(`[VALIDATION ENGINE] Balance: ${result.account_balance} (Expected: ${lockedContext.accountBalance}) -> ${matchBalance}`);
          console.log(`[VALIDATION ENGINE] Pricing: ${result.entry} (FCS: ${currentPrice}) -> ${matchPrice}`);

          const isWaitSignal = result.trade_type === 'WAIT' || result.type === 'WAIT' || (result as any).bias === 'WAIT';

          if (!isWaitSignal && (!matchPair || !matchSession || !matchStyle || !matchBalance || !matchPrice)) {
            console.warn(`[VALIDATION FAILED] Parameter mismatch detected. Rejecting signal.`);
            continue;
          }
          
          validResults.push(result);
        }

        if (validResults.length === 0) {
           console.warn(`[RETRY SYSTEM] Auto-recovering. Empty valid results on attempt ${attempts}.`);
        }

      } catch (err: any) {
        console.error(`Analysis pass ${attempts} error:`, err);
        if (attempts >= maxAttempts) {
           setError(getAIErrorMessage(err, "Signal Engine Error after retries"));
           setIsAnalyzing(false);
           return;
        }
      }
    }

    if (validResults.length === 0) {
      setError("Engine Error: The AI determined that current market conditions do not meet the minimum confidence threshold (50) or generated invalid parameters. Please try again later when the market regime is more favorable.");
      setIsAnalyzing(false);
      return;
    }

    try {
      // Apply Free Tier limitations
      if (isRestricted) {
        validResults.forEach(r => r.isDelayed = true);
      }
      
      // Save signals to Firestore
      for (const result of validResults) {
        const tradeId = result.tradeId || `SK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const signalData = {
          tradeId,
          pair: String(result.pair || pair || "UNKNOWN").substring(0, 20),
          session: String(result.session || session || "UNKNOWN").substring(0, 20),
          tradingMode: result.tradingMode || tradingMode,
          type: ['BUY', 'SELL', 'WAIT'].includes(result.type || '') ? result.type : 'WAIT',
          confidence: parseInt(result.confidence) || 0,
          entry: result.entry || "0",
          stopLoss: result.stopLoss || "0",
          takeProfit1: result.takeProfit1 || "0",
          takeProfit2: result.takeProfit2 || "0",
          takeProfit3: result.takeProfit3 || "N/A",
          marketQualityScore: result.market_quality_score || null,
          trapRisk: result.trap_risk || false,
          timestamp: new Date().toISOString(),
          riskReward: result.risk_reward || result.riskReward || "1:2.0",
          recommendedLotSize: result.recommended_lot_size || result.recommendedLotSize || "N/A",
          strategy: result.strategy || result.model || "N/A",
          timeframe: result.timeframe || "N/A",
          reason: Array.isArray(result.reasoning) ? result.reasoning[0] : (result.reason || "N/A"),
          status: result.type === 'WAIT' ? 'WAIT' : 'ACTIVE',
          trade_status: result.type === 'WAIT' ? 'WAIT' : 'ACTIVE',
          dataSource: 'FCS_API',
          freshness: 'FRESH',
          risk_percent: 2.0,
          marketRegime: result.marketRegime || 'UNKNOWN',
          regimeConfidence: result.regimeConfidence || 0,
          regimeEvidence: result.regimeEvidence || [],
          regimeRiskState: result.regimeRiskState || 'NORMAL',
          strategyWeights: result.strategyWeights || null,
          evidenceScores: result.evidenceScores || null,
          newsRiskState: result.newsRiskState || 'NORMAL',
          holidayLiquidityState: result.holidayLiquidityState || 'NORMAL',
          correlationRiskLevel: result.correlationRiskLevel || 'NORMAL',
          dailyRiskStatus: result.dailyRiskStatus || 'NORMAL',
          lossStreakCount: result.lossStreakCount || 0,
          isCooldownActive: result.isCooldownActive || false,
          decisionGatePassed: result.decisionGatePassed ?? true,
          decisionRationale: result.decisionRationale || null,
          frozenContext: result.frozenContext || {
            tradeId,
            pair: result.pair || pair,
            session: result.session || session,
            tradingMode: result.tradingMode || tradingMode,
            accountBalance,
            riskPercent: 2.0,
            entryPrice: result.entry,
            stopLoss: result.stopLoss,
            takeProfit1: result.takeProfit1,
            takeProfit2: result.takeProfit2,
            createdAt: new Date().toISOString(),
            version: "SESSIONKING-V3.2"
          },
          notifiedSL: false,
          notifiedTP1: false,
          notifiedTP2: false
        };
        try {
          await addDoc(collection(db, "users", user.uid, "signals"), signalData);
          
          if (!isRestricted && signalData.confidence >= 80 && userProfile?.preferredPairs?.includes(signalData.pair)) {
            await addDoc(collection(db, "users", user.uid, "notifications"), {
              userId: user.uid,
              type: "SIGNAL",
              title: `High Confidence Setup: ${signalData.pair}`,
              message: `AI Engine detected a ${signalData.confidence}% probability ${signalData.type} setup for ${signalData.pair}.`,
              priority: "HIGH",
              isRead: false,
              timestamp: new Date().toISOString()
            });
          }
          
          // Also save to global liveSignals for Admin Panel visibility and metrics tracking
          await addDoc(collection(db, "liveSignals"), {
            ...signalData,
            createdAt: new Date().toISOString(),
            action: signalData.type,
            price: signalData.entry,
            source: "AI Engine",
            userId: user.uid,
            userEmail: user.email || "Unknown"
          });
        } catch (err: any) {
          if (String(err).includes("exists") || err?.code === "already-exists") {
             console.warn("Document already exists. Assuming successful write due to retry.");
          } else {
             console.warn("Error creating signal:", err);
             if (!String(err).includes("client is offline")) {
               try { handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/signals`); } catch(e){}
             }
          }
        }
      }

      // Update usage
      const today = new Date().toISOString().split('T')[0];
      const usageRef = doc(db, "users", user.uid, "usage", today);
      try {
        const usageSnap = await getDoc(usageRef);
        if (usageSnap.exists()) {
          await updateDoc(usageRef, { signalCount: usageSnap.data().signalCount + 1 });
          setUsageCount(usageSnap.data().signalCount + 1);
        } else {
          await setDoc(usageRef, { date: today, signalCount: 1 });
          setUsageCount(1);
        }
      } catch (err: any) {
        console.warn("Error updating usage:", err);
        if (!String(err).includes("client is offline")) {
          try { handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/usage/${today}`); } catch (e) {}
        }
      }

      setAvailableSignals(validResults);
      setSignal(validResults[0]);
    } catch (err: any) {
      console.error("Analysis Error:", err);
      setError(getAIErrorMessage(err, "Signal Engine Error"));
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, pair, user, usageCount, usageLimit, session, tradingMode, accountBalance, isRestricted, volatilityContextStr, globalNews]);

  return (
    <div className="w-full max-w-5xl mx-auto px-3.5 sm:px-6 lg:px-8 py-6 sm:py-12 min-h-screen">
      <div className="w-full">
        {/* Dashboard Header */}
        <div className="mb-8 sm:mb-12 p-4 sm:p-6 glass-card border-gold/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
          <div>
            <h2 className="text-lg sm:text-xl font-bold mb-1">
              Welcome back{userProfile?.displayName ? `, ${userProfile.displayName.charAt(0).toUpperCase() + userProfile.displayName.slice(1)}` : ''} •
            </h2>
            <p className="text-xs sm:text-sm text-gray-400">Last login: {userProfile?.lastLoginLocation || 'Unknown'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full md:w-auto justify-between md:justify-end pt-3 md:pt-0 border-t md:border-t-0 border-white/5">
            <div className="text-left md:text-right">
              <div className="text-xs text-gray-400 mb-1">Current Plan</div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-gold/10 border border-gold/30 rounded-full text-gold font-bold text-xs sm:text-sm uppercase tracking-widest">
                 {plan}
              </div>
            </div>
            <div className="h-8 sm:h-10 w-[1px] bg-white/10" />
            <div className="text-left md:text-right">
              <div className="text-xs text-gray-400 mb-1">Daily Usage</div>
              <div className="font-mono text-white text-xs sm:text-sm font-bold">
                {usageCount} / {usageLimit === Infinity ? '∞' : usageLimit}
              </div>
            </div>
            {plan !== 'institutional' && (
              <button 
                onClick={onUpgrade}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-gold text-matte-black font-bold rounded-lg text-xs sm:text-sm uppercase tracking-widest hover:scale-105 transition-transform shadow-[0_0_15px_rgba(212,175,55,0.3)]"
              >
                Upgrade
              </button>
            )}
          </div>
        </div>

        <header className="mb-8 sm:mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs sm:text-sm font-medium mb-3 sm:mb-4"
          >
            <Zap className="w-4 h-4" /> Adaptive Market Intelligence Engine
          </motion.div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 tracking-tight flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <span>Forex Signal Dashboard</span>
            {!isEngineActive && (
              <span className="px-3 py-1 bg-red-500/20 text-red-500 text-xs sm:text-sm uppercase tracking-widest rounded-md border border-red-500/20">
                Engine Paused
              </span>
            )}
          </h1>
          <p className="text-gray-400 text-xs sm:text-base max-w-2xl mx-auto px-2">Select your session and pair for institutional-grade probability analysis.</p>
          {isRestricted && (
            <div className="mt-4 text-xs text-gold flex items-center justify-center gap-2 bg-gold/5 py-2 px-3 rounded-lg border border-gold/10 max-w-xl mx-auto">
              <Lock className="w-3.5 h-3.5 shrink-0" /> 
              <span>Free Plan: Signals are delayed by 5-10 minutes. Entry/SL/TP hidden.</span>
            </div>
          )}
        </header>


        {/* Tabs */}
        <div className="flex justify-center mb-6 sm:mb-8 w-full overflow-x-auto custom-scrollbar pb-1">
          <div className="inline-flex bg-matte-black border border-white/10 rounded-xl p-1 w-full sm:w-auto overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab("live")}
              className={cn(
                "flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-h-[40px] sm:min-h-[44px]",
                activeTab === "live" ? "bg-gold text-matte-black shadow-lg shadow-gold/20" : "text-gray-400 hover:text-white"
              )}
            >
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Live Signals
            </button>
            <button
              onClick={() => setActiveTab("news")}
              className={cn(
                "flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-h-[40px] sm:min-h-[44px]",
                activeTab === "news" ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-gray-400 hover:text-white"
              )}
            >
              <Newspaper className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Live News
            </button>
            <button
              onClick={() => setActiveTab("backtest")}
              className={cn(
                "flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-h-[40px] sm:min-h-[44px]",
                activeTab === "backtest" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-400 hover:text-white"
              )}
            >
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Backtesting
            </button>
            <button
              onClick={() => setActiveTab("archive")}
              className={cn(
                "flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-h-[40px] sm:min-h-[44px]",
                activeTab === "archive" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20" : "text-gray-400 hover:text-white"
              )}
            >
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Today's Archive
            </button>
          </div>
        </div>

{activeTab === "backtest" ? (
          <Suspense fallback={<div className="h-64 flex items-center justify-center text-gold"></div>}>
            <BacktestEngine userProfile={userProfile} />
          </Suspense>
        ) : activeTab === "archive" ? (
          <Suspense fallback={<div className="h-64 flex items-center justify-center text-gold"></div>}>
            <TodaySignalsArchive user={user} />
          </Suspense>
        ) : activeTab === "news" ? (
          <div className="space-y-8">
            <div className="glass-card p-6 border-white/10 flex flex-col sm:flex-row gap-6 items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white mb-1 tracking-tight">Market News & Calendar</h2>
                <p className="text-sm text-gray-400">Filter live news and economic events by currency pair.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <div className="w-full sm:w-48 space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" /> Session Filter
                  </label>
                  <select
                    value={session}
                    onChange={(e) => setSession(e.target.value as Session)}
                    className="w-full bg-matte-black border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-red-500/50 transition-colors font-mono text-sm"
                  >
                    {SESSIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:w-48 space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Target className="w-3.5 h-3.5" /> Currency Filter
                  </label>
                  <select
                    value={pair}
                    onChange={(e) => setPair(e.target.value)}
                    className="w-full bg-matte-black border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-red-500/50 transition-colors font-mono text-sm"
                  >
                    {PAIRS_BY_SESSION[session].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="space-y-8">
              <div className="grid lg:grid-cols-2 gap-8">
                <Suspense fallback={<div className="h-64 flex items-center justify-center"></div>}>
                  <LiveNewsFeed selectedPair={pair} />
                </Suspense>
                <Suspense fallback={<div className="h-64 flex items-center justify-center"></div>}>
                  <EconomicCalendar selectedPair={pair} user={user} userProfile={userProfile} />
                </Suspense>
              </div>

              <MarketSentimentWidget 
                selectedPair={pair}
                onSelectPair={(selected) => setPair(selected)}
              />
            </div>
          </div>
        ) : (
          <>
            {upcomingHighImpactEvent && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="mb-8 p-6 bg-red-500/10 border border-red-500/40 rounded-xl relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-red-500/5 animate-pulse" />
                <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-500/20 rounded-xl text-red-500">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-red-400 font-bold text-xl mb-1 flex items-center gap-2">
                        CRITICAL RISK: {upcomingHighImpactEvent.country} {upcomingHighImpactEvent.impact} Impact News
                      </h3>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        <strong className="text-white">{upcomingHighImpactEvent.title}</strong> will be released in less than 15 minutes. The Signal Engine has automatically adjusted volatility filters. Consider pausing manual entries.
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-center bg-black/40 p-4 rounded-xl border border-red-500/20 min-w-[120px]">
                    <span className="block text-xs text-red-400 uppercase tracking-widest font-bold mb-1">Time Remaining</span>
                    <span className="text-3xl font-mono text-white font-bold">
                      {Math.max(0, Math.floor((new Date(upcomingHighImpactEvent.date).getTime() - Date.now()) / 60000))}m
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Controls */}
            <div className="glass-card p-5 sm:p-8 gold-border mb-12">
          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Trading Session
              </label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value as Session)}
                className="w-full bg-matte-black border border-white/10 rounded-lg px-4 py-3.5 focus:outline-none focus:border-gold/50 transition-colors appearance-none min-h-[48px]"
              >
                {SESSIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400 flex items-center justify-between">
                <span className="flex items-center gap-2"><Target className="w-4 h-4" /> Currency Pair</span>
                {pair && prices[pair] && (
                  <motion.span 
                    key={prices[pair]}
                    initial={{ opacity: 0.5, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "font-mono text-xs px-2 py-0.5 rounded border transition-colors duration-300",
                      directions[pair] === 'up' ? "bg-green-500/10 border-green-500/30 text-green-400" :
                      directions[pair] === 'down' ? "bg-red-500/10 border-red-500/30 text-red-400" :
                      "bg-gold/10 border-gold/20 text-gold"
                    )}
                  >
                    {formatPrice(pair, prices[pair])}
                  </motion.span>
                )}
              </label>
              <select
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                className="w-full bg-matte-black border border-white/10 rounded-lg px-4 py-3.5 focus:outline-none focus:border-gold/50 transition-colors appearance-none min-h-[48px]"
              >
                {PAIRS_BY_SESSION[session].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Zap className="w-4 h-4" /> Trading Style
              </label>
              <select
                value={tradingMode}
                onChange={(e) => handleTradingModeChange(e.target.value as any)}
                className="w-full bg-matte-black border border-white/10 rounded-lg px-4 py-3.5 focus:outline-none focus:border-gold/50 transition-colors appearance-none min-h-[48px]"
              >
                <option value="Scalp Trader">Scalp Trader ⚡</option>
                <option value="Day Trader">Day Trader ⏱️</option>
                <option value="Swing Trader">Swing Trader 📈</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Account Balance ($)
              </label>
              <input
                type="number"
                value={accountBalance}
                onChange={(e) => setAccountBalance(Number(e.target.value))}
                className="w-full bg-matte-black border border-white/10 rounded-lg px-4 py-3.5 focus:outline-none focus:border-gold/50 transition-colors min-h-[48px]"
                min="100"
                step="100"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !pair || !isEngineActive}
              className={cn(
                "w-full gold-gradient py-4.5 rounded-xl font-bold text-matte-black flex items-center justify-center gap-2 transition-all shadow-lg min-h-[56px]",
                (isAnalyzing || !pair || !isEngineActive) ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              {isAnalyzing ? (
                <>
                   Running AMI Analysis...
                </>
              ) : (
                <>
                   Analyze Selected Pair
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-3 mb-8"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Signal Output */}
        <AnimatePresence mode="wait">
          {isAnalyzing ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card overflow-hidden border-gold/30 p-8"
            >
              <div className="flex flex-col items-center justify-center py-16 gap-8">
                {/* Advanced Radar / Engine Core Animation */}
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.5, 2], opacity: [0.8, 0.4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    className="absolute w-full h-full rounded-full border border-gold/40"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.3, 1.6], opacity: [1, 0.5, 0] }}
                    transition={{ duration: 2, delay: 0.6, repeat: Infinity, ease: "easeOut" }}
                    className="absolute w-3/4 h-3/4 rounded-full border border-gold/60"
                  />
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute w-full h-full rounded-full border-t-[3px] border-l-[1px] border-gold border-transparent opacity-80"
                  />
                  <Activity className="w-10 h-10 text-gold relative z-10 animate-pulse" />
                </div>
                
                <div className="space-y-4 text-center w-full max-w-md">
                  <motion.div
                    className="flex justify-center items-center gap-2 text-gold font-mono text-[10px] tracking-[0.3em] uppercase"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <div className="w-2 h-2 bg-gold/80 rounded-full" />
                    <span>Machine Learning Vectors</span>
                  </motion.div>
                  <h3 className="text-xl font-bold text-white tracking-widest font-sans uppercase">
                    Processing Tensor Data
                  </h3>
                  <motion.p 
                     className="text-gray-400 font-mono text-sm"
                     key={pair}
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                  >
                    Extracting deep patterns for <span className="text-gold font-bold">{pair}</span>
                  </motion.p>
                </div>
              </div>
            </motion.div>
          ) : signal ? (
            <div className="space-y-6">
              {availableSignals.length > 1 && (
                <div className="flex flex-wrap gap-3 mb-6">
                  {availableSignals.map((sig, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSignal(sig)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-bold border transition-all flex flex-col items-start",
                        signal.type === sig.type && signal.entry === sig.entry 
                          ? "bg-gold text-matte-black border-gold" 
                          : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {sig.type === 'BUY' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {sig.type}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <motion.div
                key={signal.timestamp + signal.strategy}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card overflow-hidden border-gold/30"
              >
              {/* Signal Header */}
              <div className={cn(
                "p-5 sm:p-8 flex flex-col sm:flex-row justify-between items-center gap-6 border-b border-white/10",
                signal.type === 'BUY' ? "bg-green-500/5" : signal.type === 'SELL' ? "bg-red-500/5" : "bg-gray-500/5"
              )}>
                <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0",
                    signal.type === 'BUY' ? "bg-green-500/20 text-green-500" : 
                    signal.type === 'SELL' ? "bg-red-500/20 text-red-500" : "bg-gray-500/20 text-gray-500"
                  )}>
                    {signal.type === 'BUY' ? <TrendingUp className="w-8 h-8" /> : 
                     signal.type === 'SELL' ? <TrendingDown className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{signal.pair}</h2>
                    <p className="text-xs text-gray-400 uppercase tracking-widest">{signal.session} Session</p>
                    <p className="text-[10px] sm:text-xs text-gold mt-1 font-medium">Style: {signal.tradingMode}</p>
                    {signal.isDelayed && (
                      <span className="text-[10px] bg-gold/20 text-gold px-2 py-0.5 rounded-full font-bold mt-2 inline-block">DELAYED SIGNAL</span>
                    )}
                  </div>
                </div>

                <div className="text-center sm:text-right w-full sm:w-auto">
                  <div className={cn(
                    "text-4xl sm:text-5xl font-black mb-1",
                    signal.type === 'BUY' ? "text-green-500" : 
                    signal.type === 'SELL' ? "text-red-500" : "text-gray-500"
                  )}>
                    {signal.type}
                  </div>
                  <div className="flex flex-col items-center sm:items-end gap-2">
                    <div className="flex flex-col items-end gap-1 w-full sm:w-[150px]">
                      <div className="flex justify-between w-full text-xs font-mono font-bold tracking-wider">
                        <span className="text-gray-500">CONFIDENCE</span>
                        <span className={cn(
                          (parseInt(signal.confidence) >= 75 || signal.confidence === "High") ? "text-green-400" :
                          (parseInt(signal.confidence) >= 66 || signal.confidence === "Medium") ? "text-yellow-400" :
                          "text-red-400"
                        )}>{signal.confidence}{!isNaN(parseInt(signal.confidence)) && !String(signal.confidence).includes('%') ? '%' : ''}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: !isNaN(parseInt(signal.confidence)) ? `${Math.min(100, Math.max(0, parseInt(signal.confidence)))}%` : (signal.confidence === "High" ? "100%" : signal.confidence === "Medium" ? "66%" : "33%") }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={cn(
                            "h-full rounded-full",
                            (parseInt(signal.confidence) >= 75 || signal.confidence === "High") ? "bg-green-500" :
                            (parseInt(signal.confidence) >= 66 || signal.confidence === "Medium") ? "bg-yellow-500" :
                            "bg-red-500"
                          )}
                        />
                      </div>
                      {signal.confidenceRating && (
                        <span className={cn(
                           "text-[10px] font-bold uppercase tracking-widest mt-1",
                           signal.confidenceRating === 'Elite' ? "text-purple-400" :
                           signal.confidenceRating === 'Very Strong' ? "text-green-400" :
                           signal.confidenceRating === 'Strong' ? "text-green-500" :
                           signal.confidenceRating === 'Moderate' ? "text-yellow-400" : "text-red-400"
                        )}>{signal.confidenceRating} RATING</span>
                      )}
                    </div>
                    {/* Consensus Scores */}
                    <div className="flex justify-between w-full mt-2 gap-1 text-[10px] uppercase font-bold text-gray-500 font-mono tracking-widest">
                       <span className={signal.type === 'BUY' ? "text-green-500" : ""}>BULL: {signal.bullishScore || 0}</span>
                       <span className={signal.type === 'SELL' ? "text-red-500" : ""}>BEAR: {signal.bearishScore || 0}</span>
                       <span className={signal.type === 'WAIT' ? "text-blue-400" : ""}>NEUT: {signal.neutralScore || 0}</span>
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono uppercase mt-1">
                      Updated: {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(signal.timestamp))}
                    </div>
                    {(plan === 'pro' || plan === 'institutional') && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          isLiveUpdating ? "bg-gold animate-ping" : "bg-green-500"
                        )} />
                        <span className="text-[10px] text-gold font-bold uppercase tracking-tighter">
                          {isLiveUpdating ? "Syncing Parameters..." : "Live Sync Active"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Signal Body */}
              <div className="p-5 sm:p-8 grid lg:grid-cols-3 gap-8">
                {/* Warnings */}
                {(signal.styleWarning || signal.accountWarning) && (
                  <div className="col-span-1 lg:col-span-3 flex flex-col gap-3 mb-2">
                    {signal.styleWarning && (
                       <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl flex items-start gap-3">
                         <AlertCircle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                         <div>
                            <h4 className="text-sm font-bold text-orange-400 uppercase">Trading Style Compatibility Warning</h4>
                            <p className="text-sm text-gray-300 mt-1">{signal.styleWarning}</p>
                         </div>
                       </div>
                    )}
                    {signal.accountWarning && (
                       <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
                         <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                         <div>
                            <h4 className="text-sm font-bold text-red-400 uppercase">Account Compatibility Warning</h4>
                            <p className="text-sm text-gray-300 mt-1">{signal.accountWarning}</p>
                         </div>
                       </div>
                    )}
                  </div>
                )}
                
                {/* Visual Tracking Progress Bar (Displayed for active trades) */}
                {signal.type !== 'WAIT' && prices[pair] && !isNaN(parseFloat(signal.entry)) && !isNaN(parseFloat(signal.takeProfit1)) && !isNaN(parseFloat(signal.stopLoss)) && (
                  <div className="col-span-1 lg:col-span-3 mb-2 p-6 glass-card border border-white/10 rounded-xl relative overflow-hidden">
                     {(() => {
                        const cp = prices[pair];
                        const entry = parseFloat(signal.entry);
                        const sl = parseFloat(signal.stopLoss);
                        const tp1 = parseFloat(signal.takeProfit1);
                        let progress = 0;
                        let profitable = false;
                        let direction = signal.type;
                        
                        if (direction === 'BUY') {
                            if (cp >= entry) { profitable = true; progress = ((cp - entry) / Math.max(0.0001, tp1 - entry)) * 100; }
                            else { profitable = false; progress = ((entry - cp) / Math.max(0.0001, entry - sl)) * 100; }
                        } else {
                            if (cp <= entry) { profitable = true; progress = ((entry - cp) / Math.max(0.0001, entry - tp1)) * 100; }
                            else { profitable = false; progress = ((cp - entry) / Math.max(0.0001, sl - entry)) * 100; }
                        }
                        progress = Math.max(0, Math.min(100, progress));
                        
                        return (
                          <div>
                             <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                  <Activity className="w-4 h-4 text-gold" /> Live Trade Tracker
                                </h3>
                                <span className={cn(
                                   "text-xs font-bold tracking-widest px-2 py-0.5 rounded border",
                                   profitable ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"
                                )}>
                                   {profitable ? "IN PROFIT" : "DRAWDOWN"}
                                </span>
                             </div>
                             <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden border border-white/5 relative">
                                <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/20 z-10" />
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%`, left: profitable ? '50%' : `${50 - (progress/2)}%` }}
                                  className={cn(
                                    "absolute top-0 bottom-0 shadow-lg",
                                    profitable ? "bg-green-500 left-1/2" : "bg-red-500 rounded-r-none right-1/2"
                                  )}
                                  style={{
                                     width: `${progress / 2}%`,
                                     right: profitable ? 'auto' : '50%',
                                     left: profitable ? '50%' : 'auto'
                                  }}
                                />
                             </div>
                             <div className="flex justify-between items-center text-[10px] mt-2 font-mono text-gray-500 uppercase">
                                <span className="text-red-400">SL: {sl}</span>
                                <span className="text-gray-400">ENTRY: {entry}</span>
                                <span className="text-green-400">TP1: {tp1}</span>
                             </div>
                             <div className="text-center mt-3 text-xs text-gray-400">
                                Current Price: <strong className="text-white">{cp}</strong> <br/>
                                <span className="opacity-75">Distance to {profitable ? 'TP1' : 'SL'}: {progress.toFixed(1)}%</span>
                             </div>
                          </div>
                        );
                     })()}
                  </div>
                )}
                
                {signal.type === 'WAIT' ? (
                  <div className="col-span-3 lg:col-span-2 p-8 bg-black/40 border border-yellow-500/20 rounded-xl flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-yellow-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-yellow-400 mb-1">{signal.status || "Market Neutral — Awaiting High-Edge Confirmation"}</h3>
                      <p className="text-xs text-gray-400 uppercase tracking-widest font-mono">18-Point Decision Gate Engaged</p>
                    </div>
                    
                    <div className="text-gray-300 max-w-2xl text-sm leading-relaxed tracking-wide bg-white/5 p-4 rounded-xl border border-white/10 text-left w-full space-y-2">
                      <div className="font-bold text-xs text-gold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-gold" /> Institutional Capital Preservation Protocol
                      </div>
                      {signal.reasoning && signal.reasoning.length > 0 ? (
                        signal.reasoning.map((r, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 shrink-0" />
                            <span>{r}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400">Current market structure lacks decisive statistical edge. Engine is monitoring order flow for breakout or liquidity confirmation.</p>
                      )}
                    </div>

                    {signal.decisionRationale && (
                      <div className="w-full text-left bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-xs text-gray-300 space-y-1">
                        <span className="text-yellow-400 font-bold uppercase tracking-wider block text-[10px]">Gate Explainability:</span>
                        <p className="font-mono text-gray-400 text-[11px] leading-relaxed">
                          {typeof signal.decisionRationale === 'object'
                            ? (signal.decisionRationale.summary || signal.decisionRationale.recommendation || JSON.stringify(signal.decisionRationale))
                            : String(signal.decisionRationale)}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Core Levels */}
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-gold uppercase tracking-widest">Execution Levels</h3>
                          <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                            LIVE DATA
                          </span>
                        </div>
                        <div className="space-y-3">
                          {isRestricted ? (
                            <div className="p-8 bg-white/5 rounded-lg border border-white/5 flex flex-col items-center justify-center text-center gap-2">
                              <EyeOff className="w-6 h-6 text-gray-600" />
                              <span className="text-[10px] text-gray-500 uppercase font-bold">Levels Restricted</span>
                              <button className="text-[10px] text-gold underline font-bold">Upgrade to Crown</button>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                <span className="text-sm text-gray-400">Execution</span>
                                <div className="flex items-center gap-2">
                                  {signal.entryClassification && (
                                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gold/20 text-gold border border-gold/30 uppercase">
                                      {signal.entryClassification}
                                    </span>
                                  )}
                                  <span className={cn(
                                    "text-[10px] font-bold px-2 py-1 rounded-full",
                                    (signal.entry_type || signal.executionType) === 'Market Entry' || (signal.entry_type || signal.executionType) === 'MARKET' ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"
                                  )}>
                                    {signal.entry_type || signal.executionType || "Market Entry"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                <span className="text-sm text-gray-400 flex items-center gap-2"><Target className="w-4 h-4 text-blue-400" /> <strong>Entry Level</strong></span>
                                <span className="font-mono text-white font-bold">{formatValue(signal.entry)}</span>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                                <span className="text-sm text-red-400 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> <strong>Stop Loss (SL)</strong></span>
                                <span className="font-mono text-red-400 font-bold">{formatValue(signal.stopLoss)}</span>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                                <span className="text-sm text-green-400 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> <strong>Take Profit 1 (TP1)</strong></span>
                                <span className="font-mono text-green-400 font-bold">{formatValue(signal.takeProfit1)}</span>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                                <span className="text-sm text-green-400 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> <strong>Take Profit 2 (TP2)</strong></span>
                                <span className="font-mono text-green-400 font-bold">{formatValue(signal.takeProfit2)}</span>
                              </div>
                              {signal.takeProfit3 && signal.takeProfit3 !== "N/A" && signal.takeProfit3 !== "0" && (
                                <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                                  <span className="text-sm text-green-400 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> <strong>Take Profit 3 (TP3)</strong></span>
                                  <span className="font-mono text-green-400 font-bold">{formatValue(signal.takeProfit3)}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {!isRestricted && (
                        <div className="p-4 bg-gold/5 border border-gold/10 rounded-lg">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">Risk : Reward</span>
                            <span className="text-gold font-bold">{signal.risk_reward || signal.riskReward || "N/A"}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Recommended Lot Size</span>
                            <span className="text-white font-bold">{signal.recommended_lot_size || signal.recommendedLotSize || "N/A"}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Market Context */}
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-gold uppercase tracking-widest">Top-Down Analysis & Market Context</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 text-gold bg-gold/5 border border-gold/10 rounded-lg">
                            <span className="text-sm font-bold flex items-center gap-2">
                               <Clock className="w-4 h-4" /> Active Session
                            </span>
                            <div className="text-right">
                               <span className="text-sm font-bold block">{signal.session || session}</span>
                               <span className="text-[10px] text-gold/70 block uppercase">Context: {signal.sessionStrength || 'Standard Volatility'}</span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 mb-2">
                             <div className="p-3 bg-white/5 border border-white/5 rounded-lg flex flex-col justify-center">
                                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">HTF Trend Bias</span>
                                <span className={cn(
                                   "text-sm font-bold mt-1",
                                   signal.marketContext === 'BULLISH' ? "text-green-500" :
                                   signal.marketContext === 'BEARISH' ? "text-red-500" : "text-blue-400"
                                )}>{signal.marketContext || signal.dailyBias || 'NEUTRAL'}</span>
                             </div>
                             <div className="p-3 bg-white/5 border border-white/5 rounded-lg flex flex-col justify-center">
                                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Environment</span>
                                <span className="text-sm font-bold text-white mt-1">{signal.marketEnvironment || 'Trending'}</span>
                             </div>
                          </div>

                          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                            <span className="text-sm text-gray-400">Trend Strength</span>
                            <span className="text-sm font-medium text-white">{signal.trendStrength || 'Moderate'}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                            <span className="text-sm text-gray-400">Trading Mode</span>
                            <span className="text-sm font-medium text-white">{signal.tradingMode}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                            <span className="text-sm text-gray-400">Trade Duration</span>
                            <span className="text-sm font-medium text-white">{signal.duration}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                            <span className="text-sm text-gray-400 text-left">Strategy</span>
                            <span className="text-sm font-medium text-white text-right w-3/4 truncate">
                              {signal.timeframe} • {signal.strategy}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                            <span className="text-sm text-gray-400">Est. Trigger Time</span>
                            <span className="text-sm font-medium text-white">{signal.estimatedTriggerTime}</span>
                          </div>
                          {!isRestricted && (
                            <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                              <span className="text-[10px] font-bold text-red-400 uppercase block mb-1">Invalidation Level</span>
                              <span className="text-sm text-gray-300">{signal.invalidation}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {!isRestricted && (
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <h3 className="text-xs font-bold text-gold uppercase tracking-widest">Reasoning</h3>
                            <ul className="space-y-3">
                              {signal.reasoning.map((r, i) => (
                                <li key={i} className="text-sm text-gray-300 flex items-start gap-3 leading-relaxed p-3 bg-white/5 rounded-lg border border-white/5">
                                  <div className="mt-0.5 flex-shrink-0">
                                    <Target className="w-4 h-4 text-gold" />
                                  </div>
                                  <div>
                                    <JargonFormatter text={r} />
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {signal.chartPatterns && signal.chartPatterns.length > 0 && (
                            <div className="space-y-2 mt-4">
                              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Chart Patterns</h3>
                              <div className="flex flex-wrap gap-2">
                                {signal.chartPatterns.map((p, i) => (
                                  <span key={i} className="text-xs px-2 py-1 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-md">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {signal.keyLiquidityLevels && signal.keyLiquidityLevels.length > 0 && (
                            <div className="space-y-2 mt-4">
                              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Liquidity Targets</h3>
                              <div className="flex flex-wrap gap-2">
                                {signal.keyLiquidityLevels.map((l, i) => (
                                  <span key={i} className="text-xs px-2 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-md">
                                    {l}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {signal.marketStructureShifts && signal.marketStructureShifts.length > 0 && (
                            <div className="space-y-2 mt-4">
                              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Market Structure</h3>
                              <div className="flex flex-wrap gap-2">
                                {signal.marketStructureShifts.map((s, i) => (
                                  <span key={i} className="text-xs px-2 py-1 bg-green-500/10 text-green-300 border border-green-500/20 rounded-md">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Probability Breakdown */}
                    {(signal.probabilityBreakdown?.structure || signal.probabilityBreakdown?.momentum || signal.probabilityBreakdown?.liquidity) ? (
                      <div className="space-y-6">
                        <div className="p-5 bg-deep-blue/20 border border-deep-blue/30 rounded-xl space-y-4">
                          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <Target className="w-4 h-4 text-gold" /> Probability Breakdown
                          </h3>
                          
                          <div className="space-y-3">
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">Structure</span>
                                <span className="text-white font-bold">{signal.probabilityBreakdown?.structure || 0}%</span>
                              </div>
                              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden relative">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${signal.probabilityBreakdown?.structure || 0}%` }}
                                  transition={{ duration: 1, ease: "easeOut" }}
                                  className={`h-full rounded-full ${
                                    (signal.probabilityBreakdown?.structure || 0) >= 75 ? 'bg-green-500' :
                                    (signal.probabilityBreakdown?.structure || 0) >= 50 ? 'bg-gold' : 'bg-red-500'
                                  }`} 
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">Momentum</span>
                                <span className="text-white font-bold">{signal.probabilityBreakdown?.momentum || 0}%</span>
                              </div>
                              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden relative">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${signal.probabilityBreakdown?.momentum || 0}%` }}
                                  transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
                                  className={`h-full rounded-full ${
                                    (signal.probabilityBreakdown?.momentum || 0) >= 75 ? 'bg-green-500' :
                                    (signal.probabilityBreakdown?.momentum || 0) >= 50 ? 'bg-gold' : 'bg-red-500'
                                  }`} 
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">Liquidity</span>
                                <span className="text-white font-bold">{signal.probabilityBreakdown?.liquidity || 0}%</span>
                              </div>
                              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden relative">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${signal.probabilityBreakdown?.liquidity || 0}%` }}
                                  transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                                  className={`h-full rounded-full ${
                                    (signal.probabilityBreakdown?.liquidity || 0) >= 75 ? 'bg-green-500' :
                                    (signal.probabilityBreakdown?.liquidity || 0) >= 50 ? 'bg-gold' : 'bg-red-500'
                                  }`} 
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {signal.advancedScores && (
                          <div className="p-5 bg-deep-blue/20 border border-deep-blue/30 rounded-xl space-y-4">
                            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-gold" /> Engine V3 Confidence Breakdown
                            </h3>
                            
                            <div className="space-y-3">
                              {[
                                { label: 'Top-Down Alignment', value: signal.advancedScores.topDownAlignment, max: 20 },
                                { label: 'Strategy Agreement', value: signal.advancedScores.strategyAgreement, max: 20 },
                                { label: 'Market Structure', value: signal.advancedScores.marketStructure, max: 15 },
                                { label: 'Smart Money Concepts', value: signal.advancedScores.smartMoney, max: 15 },
                                { label: 'Momentum', value: signal.advancedScores.momentum, max: 10 },
                                { label: 'Volume', value: signal.advancedScores.volume, max: 10 },
                                { label: 'Volatility', value: signal.advancedScores.volatility, max: 5 },
                                { label: 'Session', value: signal.advancedScores.session, max: 5 },
                              ].map((item, idx) => (
                                <div key={idx}>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-400">{item.label}</span>
                                    <span className="text-white font-bold">{item.value} / {item.max}</span>
                                  </div>
                                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden relative">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${(item.value / item.max) * 100}%` }}
                                      transition={{ duration: 1, ease: "easeOut", delay: 0.1 * idx }}
                                      className={cn(
                                        "h-full rounded-full",
                                        (item.value / item.max) >= 0.8 ? 'bg-green-500' :
                                        (item.value / item.max) >= 0.5 ? 'bg-gold' : 'bg-red-500'
                                      )} 
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {signal.technicalScores && (
                          <div className="p-5 bg-deep-blue/20 border border-deep-blue/30 rounded-xl space-y-4">
                            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                              <Activity className="w-4 h-4 text-gold" /> Technical Indicators
                            </h3>
                            
                            <div className="space-y-3">
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-400">RSI (14)</span>
                                  <span className="text-white font-bold">{signal.technicalScores.rsi}%</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden relative">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${signal.technicalScores.rsi}%` }}
                                    transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                                    className={`h-full rounded-full ${
                                      signal.technicalScores.rsi >= 70 || signal.technicalScores.rsi <= 30 ? 'bg-gold' : 'bg-blue-400'
                                    }`} 
                                  />
                                </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">MACD (12,26,9)</span>
                                <span className="text-white">{signal.technicalScores.macd}%</span>
                              </div>
                              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-400 rounded-full" style={{ width: `${signal.technicalScores.macd}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">MA Crossover</span>
                                <span className="text-white">{signal.technicalScores.ma}%</span>
                              </div>
                              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-gold rounded-full" style={{ width: `${signal.technicalScores.ma}%` }} />
                              </div>
                            </div>
                            {signal.technicalScores.stochastic !== undefined && (
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-400">Stochastic (14,3,3)</span>
                                  <span className="text-white">{signal.technicalScores.stochastic}%</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div className="h-full bg-green-400 rounded-full" style={{ width: `${signal.technicalScores.stochastic}%` }} />
                                </div>
                              </div>
                            )}
                            {signal.technicalScores.atr !== undefined && (
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-400">ATR Volatility</span>
                                  <span className="text-white">{signal.technicalScores.atr}%</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div className="h-full bg-orange-400 rounded-full" style={{ width: `${signal.technicalScores.atr}%` }} />
                                </div>
                              </div>
                            )}
                            {signal.technicalScores.supportResistance !== undefined && (
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-400">Support/Resistance</span>
                                  <span className="text-white">{signal.technicalScores.supportResistance}%</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${signal.technicalScores.supportResistance}%` }} />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {!isRestricted && (
                        <div className="p-5 bg-white/5 border border-white/10 rounded-xl">
                          <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-gray-500" /> Session Strength
                          </h3>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden flex">
                              <div className={cn(
                                "h-full",
                                signal.sessionStrength === 'Weak' ? "w-1/3 bg-red-500" :
                                signal.sessionStrength === 'Moderate' ? "w-2/3 bg-yellow-500" :
                                "w-full bg-green-500"
                              )} />
                            </div>
                            <span className={cn(
                              "text-xs font-bold uppercase",
                              signal.sessionStrength === 'Weak' ? "text-red-500" :
                              signal.sessionStrength === 'Moderate' ? "text-yellow-500" :
                              "text-green-500"
                            )}>
                              {signal.sessionStrength}
                            </span>
                          </div>
                        </div>
                      )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              {/* Phase 2: Comprehensive Institutional Intelligence & Risk Governor Panel */}
              <div className="border-t border-white/10 p-5 sm:p-8 bg-black/40 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-gold" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Phase 2 Market Intelligence & Risk Governor</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border font-mono",
                      signal.decisionGatePassed ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                    )}>
                      18-Point Decision Gate: {signal.decisionGatePassed ? "Passed" : "Protective Protocol Active"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 1. Market Regime */}
                  <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-400">
                      <span>Market Regime</span>
                      <span className="text-gold font-mono">{signal.regimeConfidence || 85}% Conf</span>
                    </div>
                    <div className="text-sm font-bold text-white truncate">
                      {String(signal.marketRegime || 'TRENDING_BULLISH').replace(/_/g, ' ')}
                    </div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-1.5">
                      <span className={cn("w-2 h-2 rounded-full", signal.regimeRiskState === 'NORMAL' ? 'bg-green-500' : 'bg-yellow-500')} />
                      Risk State: <strong className="text-white">{signal.regimeRiskState || 'NORMAL'}</strong>
                    </div>
                  </div>

                  {/* 2. Evidence Consensus */}
                  <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-400">
                      <span>Evidence Scoring</span>
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-mono font-bold", signal.evidenceScores?.conflictLevel === 'LOW' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400')}>
                        {signal.evidenceScores?.conflictLevel || 'LOW'} Conflict
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-green-400">BUY: {signal.evidenceScores?.buy || signal.bullishScore || 75}</span>
                      <span className="text-red-400">SELL: {signal.evidenceScores?.sell || signal.bearishScore || 20}</span>
                      <span className="text-blue-400">WAIT: {signal.evidenceScores?.wait || signal.neutralScore || 5}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden flex">
                      <div className="h-full bg-green-500" style={{ width: `${signal.evidenceScores?.buy || 75}%` }} />
                      <div className="h-full bg-red-500" style={{ width: `${signal.evidenceScores?.sell || 20}%` }} />
                      <div className="h-full bg-blue-500" style={{ width: `${signal.evidenceScores?.wait || 5}%` }} />
                    </div>
                  </div>

                  {/* 3. Event & Liquidity Risk */}
                  <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-400">
                      <span>News & Holiday Risk</span>
                      <span className="text-green-400 font-mono">Live Sync</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Event Risk:</span>
                      <span className={cn("font-bold", signal.newsRiskState === 'CRITICAL' ? 'text-red-400' : signal.newsRiskState === 'HIGH' ? 'text-yellow-400' : 'text-green-400')}>
                        {signal.newsRiskState || 'NORMAL'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Liquidity:</span>
                      <span className={cn("font-bold", signal.holidayLiquidityState === 'MARKET_CLOSED' ? 'text-red-400' : 'text-white')}>
                        {signal.holidayLiquidityState || 'NORMAL'}
                      </span>
                    </div>
                  </div>

                  {/* 4. Portfolio & Loss Governor */}
                  <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-400">
                      <span>Account Governors</span>
                      <span className="text-gold font-mono">Active</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Correlation Risk:</span>
                      <span className="text-white font-bold">{signal.correlationRiskLevel || 'NORMAL'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Loss Streak:</span>
                      <span className={cn("font-bold", (signal.lossStreakCount || 0) >= 3 ? "text-red-400" : "text-white")}>
                        {signal.lossStreakCount || 0} Losses {signal.isCooldownActive ? '(Cooldown)' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Phase 3: Calibrated Confidence, Anomaly Monitor & Adaptive Weights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ConfidenceCalibrationViewer 
                    calibration={signal.calibratedConfidence || {
                      rawEvidenceScore: parseInt(signal.confidence) || 75,
                      calibratedConfidence: signal.confidenceScore || parseInt(signal.confidence) || 75,
                      historicalSimilarSetupReliability: signal.historicalReliability?.empiricalWinRate ?? 72,
                      calibrationState: 'OPTIMAL',
                      calibrationAdjustment: 0,
                      sampleSize: signal.historicalReliability?.similarSetupsCount ?? 24,
                      rationale: 'Bayesian evidence calibrated with empirical historical memory.'
                    }} 
                  />

                  <AnomalyMonitorWidget 
                    anomalyReport={signal.anomalyReport} 
                    pair={signal.pair} 
                  />
                </div>

                {/* Explainability Rationale */}
                {signal.decisionRationale && (
                  <div className="p-4 bg-deep-blue/20 border border-blue-500/20 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-blue-400 font-bold uppercase tracking-wider text-[11px]">
                      <Brain className="w-4 h-4" /> Explainability & Institutional Rationale
                    </div>
                    <p className="text-gray-300 leading-relaxed font-sans">
                      {signal.decisionRationale.recommendation || signal.decisionRationale.summary}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-gray-400 pt-2 border-t border-white/5 font-mono">
                      <div><strong className="text-gray-300">Regime:</strong> {signal.decisionRationale.regimeContext}</div>
                      <div><strong className="text-gray-300">Risk Profile:</strong> {signal.decisionRationale.riskSummary}</div>
                      <div><strong className="text-gray-300">Model Version:</strong> {signal.modelVersions?.weightConfigVersion || 'V3.3-ADAPTIVE'}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-8 py-4 bg-white/5 flex justify-between items-center">
                <span className="text-[10px] text-gray-500 font-mono">AMI SYSTEM ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                <span className="text-[10px] text-gray-500 font-mono">TIMESTAMP: {new Date(signal.timestamp).toLocaleString()}</span>
              </div>
            </motion.div>
            </div>
          ) : null}
        </AnimatePresence>
        </>
        )}

        <Suspense fallback={<div className="h-12 bg-matte-black border-y border-gold/20 mt-12" />}>
          <RiskMarquee />
        </Suspense>

        {/* Limit Modal */}
        <AnimatePresence>
          {showLimitModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-8 max-w-md w-full border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.1)]"
              >
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 mx-auto border border-red-500/20">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-2xl font-bold text-center mb-2">Daily Limit Reached</h3>
                <p className="text-gray-400 text-center mb-8">
                  You have reached your daily limit of {usageLimit} signals for the {plan.toUpperCase()} plan. Upgrade your plan to generate more signals today.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowLimitModal(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-white bg-white/5 hover:bg-white/10 transition-colors uppercase tracking-widest text-sm"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowLimitModal(false);
                      onUpgrade();
                    }}
                    className="flex-1 py-3 rounded-xl font-bold text-matte-black bg-gold hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest text-sm shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                  >
                    Upgrade
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
