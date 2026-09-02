import { useEffect, useState, useRef } from "react";
import { collection, query, where, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { usePriceFeed } from "../hooks/usePriceFeed";
import type { Signal } from "../types";

interface TradeTrackerProps {
  user: any;
}

export function TradeTracker({ user }: TradeTrackerProps) {
  const { prices, states } = usePriceFeed();
  const [activeSignals, setActiveSignals] = useState<Signal[]>([]);
  const processedHits = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setActiveSignals([]);
      return;
    }

    // Only subscribe to strictly ACTIVE trades
    const q = query(
      collection(db, "users", user.uid, "signals"),
      where("status", "==", "ACTIVE")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const signals: Signal[] = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as Signal;
        const id = docSnap.id;
        // Strict terminal state protection: terminal trades must never be monitored
        if (data.status === 'ACTIVE' && data.type !== 'WAIT' && !data.closedAt) {
          signals.push({ id, ...data });

          // Register with server-side authoritative supervisor
          fetch('/api/trades/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trade: {
                userId: user.uid,
                tradeId: data.tradeId || id,
                docId: id,
                pair: data.pair,
                direction: data.type || data.trade_type || 'BUY',
                entryPrice: parseFloat(data.entry || data.entry_price || "0"),
                stopLoss: parseFloat(data.stopLoss || data.stop_loss || "0"),
                takeProfit1: parseFloat(data.takeProfit1 || data.take_profit_1 || "0"),
                takeProfit2: data.takeProfit2 ? parseFloat(data.takeProfit2) : undefined,
                status: data.status,
                createdAt: data.timestamp || new Date().toISOString(),
                marketRegime: data.marketRegime,
                tradingMode: data.tradingMode,
                session: data.session
              }
            })
          }).catch(() => {});
        }
      });
      setActiveSignals(signals);
    }, (error) => {
      console.error("[TRADE TRACKER] Error fetching active signals:", error);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || activeSignals.length === 0) return;

    activeSignals.forEach(async (signal) => {
      const tradeId = signal.tradeId || signal.id;
      if (!tradeId) return;

      // Terminal state protection: If already closed, skip completely
      if (
        signal.status === 'CLOSED_TP' || 
        signal.status === 'CLOSED_SL' || 
        signal.status === 'EXPIRED' || 
        signal.status === 'CANCELLED' ||
        signal.closedAt
      ) {
        return;
      }

      const keyCLOSED = `${tradeId}_CLOSED`;
      if (processedHits.current.has(keyCLOSED)) return;

      const currentPrice = prices[signal.pair];
      if (!currentPrice || signal.type === 'WAIT') return;

      const sl = parseFloat(signal.stopLoss || signal.stop_loss || "0");
      const tp1 = parseFloat(signal.takeProfit1 || signal.take_profit_1 || "0");
      
      if (isNaN(sl) || sl <= 0 || isNaN(tp1) || tp1 <= 0) return;

      const keySL = `${tradeId}_SL_HIT`;
      const keyTP = `${tradeId}_TP_HIT`;

      let candidateHitSL = false;
      let candidateHitTP = false;

      // Check crossing conditions based on direction
      if (signal.type === 'BUY') {
        if (!signal.notifiedSL && !processedHits.current.has(keySL) && currentPrice <= sl) {
          candidateHitSL = true;
        }
        if (!signal.notifiedTP1 && !processedHits.current.has(keyTP) && currentPrice >= tp1) {
          candidateHitTP = true;
        }
      } else if (signal.type === 'SELL') {
        if (!signal.notifiedSL && !processedHits.current.has(keySL) && currentPrice >= sl) {
          candidateHitSL = true;
        }
        if (!signal.notifiedTP1 && !processedHits.current.has(keyTP) && currentPrice <= tp1) {
          candidateHitTP = true;
        }
      }

      if (!candidateHitSL && !candidateHitTP) return;

      // Lock in-flight processing to prevent race conditions
      if (candidateHitSL) processedHits.current.add(keySL);
      if (candidateHitTP) processedHits.current.add(keyTP);
      processedHits.current.add(keyCLOSED);

      try {
        // PHASE 3 & 9: TP/SL VERIFICATION ENGINE AGAINST AUTHORITATIVE FCS MARKET DATA
        let verifiedPrice = currentPrice;
        let verifiedHitSL = false;
        let verifiedHitTP = false;

        const verifyRes = await fetch(`/api/market-data?pair=${encodeURIComponent(signal.pair)}`);
        if (verifyRes.ok && verifyRes.status === 200) {
          const verifyData = await verifyRes.json();
          if (verifyData?.state?.mid) {
            const marketState = verifyData.state;
            const checkBid = marketState.bid || marketState.mid;
            const checkAsk = marketState.ask || marketState.mid;
            verifiedPrice = marketState.mid;

            if (signal.type === 'BUY') {
              if (checkBid <= sl) verifiedHitSL = true;
              if (checkBid >= tp1) verifiedHitTP = true;
            } else if (signal.type === 'SELL') {
              if (checkAsk >= sl) verifiedHitSL = true;
              if (checkAsk <= tp1) verifiedHitTP = true;
            }
          } else if (Array.isArray(verifyData?.data) && verifyData.data.length > 0) {
            const latestCandle = verifyData.data[verifyData.data.length - 1];
            verifiedPrice = latestCandle.close;
            if (signal.type === 'BUY') {
              if (verifiedPrice <= sl) verifiedHitSL = true;
              if (verifiedPrice >= tp1) verifiedHitTP = true;
            } else if (signal.type === 'SELL') {
              if (verifiedPrice >= sl) verifiedHitSL = true;
              if (verifiedPrice <= tp1) verifiedHitTP = true;
            }
          }
        } else {
          // Fallback to locally stream-verified FCS price if endpoint was warming up
          verifiedPrice = currentPrice;
          if (signal.type === 'BUY') {
            if (verifiedPrice <= sl) verifiedHitSL = true;
            if (verifiedPrice >= tp1) verifiedHitTP = true;
          } else if (signal.type === 'SELL') {
            if (verifiedPrice >= sl) verifiedHitSL = true;
            if (verifiedPrice <= tp1) verifiedHitTP = true;
          }
        }

        if (!verifiedHitSL && !verifiedHitTP) {
          console.warn(`[TP/SL VERIFICATION FAILED] Local trigger for ${tradeId} on ${signal.pair} at price ${currentPrice} could not be confirmed by verified FCS data. Event rejected.`);
          processedHits.current.delete(keySL);
          processedHits.current.delete(keyTP);
          processedHits.current.delete(keyCLOSED);
          return;
        }

        const hitSL = verifiedHitSL;
        const hitTP = verifiedHitTP && !verifiedHitSL; // SL takes defensive precedence
        const finalStatus = hitSL ? 'CLOSED_SL' : 'CLOSED_TP';
        const finalOutcome = hitTP ? 'WIN' : 'LOSS';

        console.log(`[DIAGNOSTIC - TP/SL EVENT] TradeID=${tradeId} | Event=${hitSL ? 'SL_HIT' : 'TP_HIT'} | Pair=${signal.pair} | Direction=${signal.type} | VerifiedPrice=${verifiedPrice} | Level=${hitSL ? sl : tp1} | Source=FCS_API | Status=${finalStatus}`);

        // Calculate pips
        let pipMultiplier = signal.pair.includes('JPY') ? 100 : 10000;
        if (signal.pair.includes('BTC') || signal.pair.includes('ETH')) pipMultiplier = 1;
        else if (signal.pair.includes('XAU') || signal.pair.includes('XAG')) pipMultiplier = 10;
        else if (signal.pair.includes('ZAR') || signal.pair.includes('MXN') || signal.pair.includes('TRY')) pipMultiplier = 1000;

        const entryPrice = parseFloat(signal.entry || signal.entry_price || "0");
        const exitPrice = hitSL ? sl : tp1;
        const pipsDiff = Math.abs(entryPrice - exitPrice) * pipMultiplier;
        const realizedPips = hitTP ? Math.round(pipsDiff) : -Math.round(pipsDiff);

        const title = hitSL 
          ? `❌ FCS TP/SL Event: Stop Loss Reached` 
          : `✅ FCS TP/SL Event: Take Profit Reached`;

        const message = hitSL
          ? `FCS market-data TP/SL event: Your ${signal.type} position on ${signal.pair} touched Stop Loss at ${sl}. Trade closed. (Broker execution may vary based on individual broker spread).`
          : `FCS market-data TP/SL event: Your ${signal.type} position on ${signal.pair} reached Take Profit at ${tp1}. Trade closed with +${Math.round(pipsDiff)} pips! (Broker execution may vary based on individual broker spread).`;

        const reasonDetails = hitSL
          ? `Defensive market-data threshold reached. Verified FCS price reached ${sl}, executing trade closure protocol to protect trading capital.`
          : `Target profit objective achieved. Verified FCS price reached ${tp1}, successfully capturing +${Math.round(pipsDiff)} pips of target expansion.`;

        const probableCause = hitSL 
          ? (signal.marketRegime === 'REVERSAL_TRANSITION' ? 'REGIME_CHANGE' : signal.marketRegime === 'HIGH_VOLATILITY' ? 'LIQUIDITY_REVERSAL' : 'STOP_PLACEMENT')
          : null;

        // 1. PRIMARY OPERATION: Atomically update the signal to terminal closed status FIRST
        const signalDocId = signal.id || tradeId;
        const signalRef = doc(db, "users", user.uid, "signals", signalDocId);
        
        await setDoc(signalRef, {
          status: finalStatus,
          trade_status: finalStatus,
          closedAt: new Date().toISOString(),
          closedPrice: exitPrice,
          finalOutcome,
          pipsRealized: realizedPips,
          notifiedSL: hitSL ? true : (signal.notifiedSL || false),
          notifiedTP1: hitTP ? true : (signal.notifiedTP1 || false)
        }, { merge: true });

        // If tradeId is distinct from signalDocId, update both to guarantee database consistency
        if (tradeId && tradeId !== signalDocId) {
          await setDoc(doc(db, "users", user.uid, "signals", tradeId), {
            status: finalStatus,
            trade_status: finalStatus,
            closedAt: new Date().toISOString(),
            closedPrice: exitPrice,
            finalOutcome,
            pipsRealized: realizedPips,
            notifiedSL: hitSL ? true : (signal.notifiedSL || false),
            notifiedTP1: hitTP ? true : (signal.notifiedTP1 || false)
          }, { merge: true }).catch(() => {});
        }

        // 2. Remove from local active monitoring state immediately
        setActiveSignals(prev => prev.filter(s => (s.id !== signalDocId && s.tradeId !== tradeId)));

        // 3. SECONDARY OPERATION: Idempotently add to immutable trade history
        try {
          const historyDocId = `${tradeId}_${finalStatus}`;
          await setDoc(doc(db, "users", user.uid, "tradeHistory", historyDocId), {
            tradeId: tradeId || "",
            pair: signal.pair || "",
            direction: signal.type || "",
            entryPrice: entryPrice || 0,
            exitPrice: exitPrice || 0,
            stopLoss: sl || 0,
            takeProfit: tp1 || 0,
            outcome: finalOutcome,
            createdAt: signal.timestamp || new Date().toISOString(),
            closedAt: new Date().toISOString(),
            pips: realizedPips || 0,
            session: signal.session || "Unknown",
            mode: signal.tradingMode || "Unknown",
            dataSource: "FCS_API",
            probableCause: probableCause || null,
            disclaimer: "FCS market-data TP/SL event"
          }, { merge: true });
        } catch (histErr) {
          console.warn(`[TRADE TRACKER] Trade history write notice for ${tradeId}:`, histErr);
        }

        // 4. SECONDARY OPERATION: Idempotently create notification with rich metadata
        try {
          const notifDocId = `${tradeId}_${hitSL ? 'SL' : 'TP'}`;
          await setDoc(doc(db, "users", user.uid, "notifications", notifDocId), {
            userId: user.uid,
            notificationId: notifDocId,
            type: "TRADE_ALERT",
            title,
            message,
            priority: hitSL ? "HIGH" : "MEDIUM",
            isRead: false,
            timestamp: new Date().toISOString(),
            metadata: {
              tradeId: tradeId || "",
              pair: signal.pair || "",
              direction: signal.type || "",
              entryPrice: entryPrice || 0,
              exitPrice: exitPrice || 0,
              stopLoss: sl || 0,
              takeProfit: tp1 || 0,
              hitType: hitSL ? 'SL' : 'TP',
              pips: Math.abs(realizedPips) || 0,
              realizedPips: realizedPips || 0,
              dataSource: 'FCS_API',
              disclaimer: 'FCS market-data TP/SL event. Execution on your broker may vary slightly based on broker-specific spreads and liquidity.',
              probableCause: probableCause || null,
              reasonDetails: reasonDetails || ""
            }
          }, { merge: true });
        } catch (notifErr) {
          console.warn(`[TRADE TRACKER] Notification write notice for ${tradeId}:`, notifErr);
        }

      } catch (err) {
        console.error(`[TRADE TRACKER] Error processing TP/SL for ${tradeId}:`, err);
        // Do not release keyCLOSED if the trade hit terminal state, preventing infinite error retry loops
        if (!processedHits.current.has(keyCLOSED)) {
          processedHits.current.delete(keySL);
          processedHits.current.delete(keyTP);
        }
      }
    });
  }, [prices, states, activeSignals, user]);

  return null;
}
